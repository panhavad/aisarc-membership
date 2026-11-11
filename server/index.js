import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELDS, FIELD_MAP, ASSOC_FIELDS, ROLES, REJECT_REASONS, CONSENT_YES, CONSENT_NO, canEdit,
} from '../public/fields.js';
import {
  db, UPLOAD_DIR, getMember, listMembers, saveMember, deleteMember, getAssociation, saveAssociation,
  termMonths, addMonths, toNumberText,
} from './db.js';
import {
  hashPassword, verifyPassword, setSession, clearSession, requireUser, requireAdmin, requireStaff,
  loginLimited, loginFailed, loginOk, verifyGoogleToken, randomPassword,
} from './auth.js';
import { importWorkbook } from './importer.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

// Bootstrap admin account from env (password is only set when the account is first created).
if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  const u = db.prepare('SELECT id FROM users WHERE username = ?').get(process.env.ADMIN_USERNAME);
  if (!u) db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?,?,'admin')")
    .run(process.env.ADMIN_USERNAME, hashPassword(process.env.ADMIN_PASSWORD));
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});
// Mutating API calls must be JSON: blocks simple cross-site form posts (CSRF).
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
  next();
});
app.use(express.json({ limit: '12mb' }));

const userPayload = (u) => ({ id: u.id, username: u.username, role: u.role, member_id: u.member_id, must_change: !!u.must_change });
const nowIso = () => new Date().toISOString();

function cleanValue(f, v) {
  let val = String(v ?? '').trim().slice(0, 2000);
  if (f.upper) val = val.toUpperCase();
  if (f.type === 'email') val = val.toLowerCase();
  if (f.type === 'number') val = toNumberText(val);
  if (f.type === 'select' && val && !f.options.includes(val)) return undefined;
  if (f.type === 'datetime' && val) {
    const d = new Date(val);
    if (isNaN(d)) return undefined;
    val = d.toISOString();
  }
  return val;
}

function pick(body, role) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    const f = FIELD_MAP[k];
    if (!f || !canEdit(f, role) || ['file', 'photo'].includes(f.type)) continue;
    const val = cleanValue(f, v);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

function validate(rec, existing = {}) {
  for (const f of FIELDS) if (f.required && !(rec[f.key] ?? existing[f.key])) return `${f.en} is required`;
  if (rec.email) {
    const other = db.prepare('SELECT id FROM members WHERE lower(email)=lower(?) AND id != ?').get(rec.email, existing.id || 0);
    if (other) return 'Email is already used by another member';
    const user = db.prepare('SELECT id FROM users WHERE username = ? AND ifnull(member_id, 0) != ?').get(rec.email, existing.id || -1);
    if (user) return 'Email is already used by another account';
  }
  if (rec.member_no) {
    const other = db.prepare('SELECT id FROM members WHERE member_no = ? AND id != ?').get(rec.member_no, existing.id || 0);
    if (other) return 'Membership no. is already used';
  }
  return null;
}

// Declaration consent drives the status: "not agree" => INACTIVE; agreeing again => back to REVIEW.
function applyConsent(rec, existing = {}) {
  if (rec.consent === CONSENT_NO) rec.status = 'INACTIVE';
  else if (rec.consent === CONSENT_YES && existing.consent === CONSENT_NO && existing.status === 'INACTIVE' && !rec.status) {
    rec.status = 'REVIEW';
    rec.applied_at = nowIso();
  }
}

// Keep the login username in sync with the member's email.
function syncUsername(memberId, email) {
  if (!email) return;
  const u = db.prepare('SELECT id FROM users WHERE member_id = ?').get(memberId);
  const clash = db.prepare('SELECT id FROM users WHERE username = ? AND member_id IS NOT ?').get(email, memberId);
  if (clash) return;
  if (u) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(email, u.id);
  else db.prepare("INSERT INTO users (username, role, member_id) VALUES (?, 'member', ?)").run(email, memberId);
}

// Approve / activate: assigns membership no. + join date (first time) and extends validity by one term.
function activate(id, by) {
  const m = getMember(id);
  const term = termMonths();
  const fields = { status: 'ACTIVE', review: { decision: 'approved', by, at: nowIso() } };
  if (term) {
    const stillValid = m.expires_at && new Date(m.expires_at) > new Date();
    fields.expires_at = stillValid ? m.expires_at : addMonths(nowIso(), term);
  }
  saveMember(id, fields);
  return getMember(id);
}

function createApplicant({ name_kh = '', name_en = '', email, phone = '' }, passwordHash) {
  const id = saveMember(null, {
    name_kh, name_en: name_en.toUpperCase(), email: email.toLowerCase(), phone, consent: CONSENT_YES,
    status: 'REVIEW', applied_at: nowIso(),
  });
  db.prepare("INSERT INTO users (username, password_hash, role, member_id) VALUES (?, ?, 'member', ?)")
    .run(email.toLowerCase(), passwordHash, id);
  return db.prepare('SELECT * FROM users WHERE member_id = ?').get(id);
}

// ---------- public ----------
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json({ googleClientId: GOOGLE_CLIENT_ID }));

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const key = `${req.ip}|${username.toLowerCase()}`;
  if (loginLimited(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !verifyPassword(req.body?.password || '', u.password_hash)) {
    loginFailed(key);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  loginOk(key);
  setSession(res, u);
  res.json({ user: userPayload(u) });
});

app.post('/api/register', (req, res) => {
  const key = `register|${req.ip}`;
  if (loginLimited(key)) return res.status(429).json({ error: 'Too many registrations. Try again later.' });
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const name_kh = String(b.name_kh || '').trim();
  const name_en = String(b.name_en || '').trim();
  if (!name_kh || !name_en) return res.status(400).json({ error: 'Please enter your name in Khmer and Latin letters' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (String(b.password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (b.consent !== true) return res.status(400).json({ error: 'You must agree to the declaration' });
  const err = validate({ email, name_kh, name_en });
  if (err) return res.status(400).json({ error: err });
  loginFailed(key); // counts registrations per IP
  const u = createApplicant({ name_kh, name_en, email, phone: String(b.phone || '').trim() }, hashPassword(b.password));
  setSession(res, u);
  res.json({ user: userPayload(u) });
});

app.post('/api/login/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google sign-in is not configured' });
  const g = await verifyGoogleToken(String(req.body?.credential || ''), GOOGLE_CLIENT_ID).catch(() => null);
  if (!g) return res.status(401).json({ error: 'Google sign-in failed' });
  const email = g.email.toLowerCase();
  let u;
  if (ADMIN_EMAILS.includes(email)) {
    u = db.prepare("SELECT * FROM users WHERE username = ? AND role = 'admin'").get(email);
    if (!u) {
      const id = db.prepare("INSERT INTO users (username, role) VALUES (?, 'admin')").run(email).lastInsertRowid;
      u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
  } else {
    const m = db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').get(email);
    if (m) {
      syncUsername(m.id, email);
      u = db.prepare('SELECT * FROM users WHERE member_id = ?').get(m.id);
    } else {
      // Unknown Google account: register as a new applicant waiting for review.
      if (db.prepare('SELECT id FROM users WHERE username = ?').get(email)) return res.status(409).json({ error: 'Account exists, sign in with password' });
      u = createApplicant({ name_en: g.name, email }, null);
    }
  }
  setSession(res, u);
  res.json({ user: userPayload(u) });
});

app.post('/api/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

// ---------- signed-in user ----------
app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: userPayload(req.user), member: req.user.member_id ? getMember(req.user.member_id) : null });
});

app.put('/api/me', requireUser, (req, res) => {
  if (!req.user.member_id) return res.status(400).json({ error: 'No member profile' });
  const existing = getMember(req.user.member_id);
  const rec = pick(req.body, 'member');
  const err = validate(rec, existing);
  if (err) return res.status(400).json({ error: err });
  applyConsent(rec, existing);
  saveMember(existing.id, rec);
  if (rec.email) syncUsername(existing.id, rec.email);
  res.json({ member: getMember(existing.id) });
});

// Member (re)submits their application / renewal for moderator review.
app.post('/api/me/submit', requireUser, (req, res) => {
  const m = req.user.member_id && getMember(req.user.member_id);
  if (!m) return res.status(400).json({ error: 'No member profile' });
  if (!['REJECTED', 'PENDING', 'INACTIVE'].includes(m.status)) return res.status(400).json({ error: 'Nothing to submit' });
  if (m.consent !== CONSENT_YES) return res.status(400).json({ error: 'Please agree to the declaration in your profile first' });
  const err = validate({}, m);
  if (err) return res.status(400).json({ error: err });
  saveMember(m.id, { status: 'REVIEW', applied_at: nowIso() });
  res.json({ member: getMember(m.id) });
});

app.post('/api/me/password', requireUser, (req, res) => {
  const { current = '', password = '' } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (u.password_hash && !u.must_change && !verifyPassword(current, u.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(hashPassword(password), u.id);
  res.json({ ok: true });
});

// Upload photo / certificate as a data URL (client resizes photos before sending).
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
function storeDataUrl(dataUrl, prefix, allowPdf) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  const ext = m && MIME_EXT[m[1]];
  if (!ext || (!allowPdf && ext === 'pdf')) throw Object.assign(new Error('Unsupported file type'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw Object.assign(new Error('File too large (max 8MB)'), { status: 413 });
  const name = `${prefix}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return name;
}
const removeUpload = (v) => {
  if (v?.startsWith('file:')) fs.rm(path.join(UPLOAD_DIR, path.basename(v.slice(5))), { force: true }, () => {});
};

app.post('/api/upload', requireUser, (req, res) => {
  const { field, dataUrl, memberId } = req.body || {};
  const f = FIELD_MAP[field];
  if (!f || !['file', 'photo'].includes(f.type)) return res.status(400).json({ error: 'Invalid field' });
  const id = req.user.role === 'admin' && memberId ? Number(memberId) : req.user.member_id;
  const existing = id && getMember(id);
  if (!existing) return res.status(404).json({ error: 'Member not found' });
  try {
    const name = storeDataUrl(dataUrl, `${id}-${field}`, f.type === 'file');
    removeUpload(existing[field]);
    saveMember(id, { [field]: `file:${name}` });
    res.json({ member: getMember(id) });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/files/:name', requireUser, (req, res) => {
  const name = path.basename(req.params.name);
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  const isPublic = name.startsWith('assoc-');
  if (!isStaff && !isPublic && req.user.member_id !== Number(name.split('-')[0])) return res.status(403).end();
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400').sendFile(file);
});

// ---------- association info ----------
app.get('/api/association', requireUser, (req, res) => res.json(getAssociation()));

app.put('/api/association', requireAdmin, (req, res) => {
  const patch = {};
  for (const f of ASSOC_FIELDS) {
    if (f.type === 'photo' || !(f.key in (req.body || {}))) continue;
    let v = String(req.body[f.key] ?? '').trim().slice(0, 4000);
    if (f.type === 'number') v = toNumberText(v) || '0';
    patch[f.key] = v;
  }
  res.json(saveAssociation(patch));
});

app.post('/api/association/qr', requireAdmin, (req, res) => {
  try {
    const name = storeDataUrl(req.body?.dataUrl, 'assoc-qr', false);
    removeUpload(getAssociation().qr);
    res.json(saveAssociation({ qr: `file:${name}` }));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ---------- staff: moderators + admins ----------
app.get('/api/members', requireStaff, (req, res) => res.json(listMembers(req.query.q)));

app.get('/api/members/:id', requireStaff, (req, res) => {
  const m = getMember(Number(req.params.id));
  m ? res.json(m) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/members/:id/review', requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const m = getMember(id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && m.status !== 'REVIEW') return res.status(400).json({ error: 'This member is not waiting for review' });
  const { decision, reason, message = '' } = req.body || {};
  if (decision === 'approve') return res.json(activate(id, req.user.username));
  if (decision !== 'reject') return res.status(400).json({ error: 'Invalid decision' });
  const r = REJECT_REASONS.find((x) => x.key === reason);
  const msg = String(message).trim().slice(0, 1000);
  if (!r) return res.status(400).json({ error: 'Please choose a reason for rejecting' });
  if (r.key === 'other' && !msg) return res.status(400).json({ error: 'Please write a message explaining the reason' });
  saveMember(id, { status: 'REJECTED', review: { decision: 'rejected', reason: r.key, message: msg, by: req.user.username, at: nowIso() } });
  res.json(getMember(id));
});

// ---------- admin only ----------
app.post('/api/members', requireAdmin, (req, res) => {
  const rec = pick(req.body, 'admin');
  const err = validate(rec);
  if (err) return res.status(400).json({ error: err });
  applyConsent(rec);
  const id = saveMember(null, rec);
  syncUsername(id, rec.email);
  res.json(getMember(id));
});

app.put('/api/members/:id', requireAdmin, (req, res) => {
  const existing = getMember(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const rec = pick(req.body, 'admin');
  const err = validate(rec, existing);
  if (err) return res.status(400).json({ error: err });
  if (rec.status === existing.status) delete rec.status; // keep derived PENDING from being stored
  applyConsent(rec, existing);
  if (rec.expires_at === existing.expires_at) delete rec.expires_at;
  saveMember(existing.id, rec);
  if (rec.email) syncUsername(existing.id, rec.email);
  if (rec.status === 'ACTIVE') return res.json(activate(existing.id, req.user.username));
  res.json(getMember(existing.id));
});

app.post('/api/members/:id/status', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!getMember(id)) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body || {};
  if (status === 'ACTIVE') return res.json(activate(id, req.user.username));
  if (status !== 'INACTIVE') return res.status(400).json({ error: 'Invalid status' });
  saveMember(id, { status: 'INACTIVE' });
  res.json(getMember(id));
});

app.put('/api/members/:id/role', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  const role = String(req.body?.role || '');
  if (!ROLES.some((r) => r.key === role)) return res.status(400).json({ error: 'Invalid role' });
  if (!m.email) return res.status(400).json({ error: 'Member needs an email to sign in' });
  syncUsername(m.id, m.email);
  db.prepare('UPDATE users SET role = ? WHERE member_id = ?').run(role, m.id);
  res.json(getMember(m.id));
});

app.delete('/api/members/:id', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (String(req.body?.confirm || '').trim() !== (m.member_no || m.email)) return res.status(400).json({ error: 'Confirmation text does not match' });
  removeUpload(m.photo);
  removeUpload(m.cert_file);
  deleteMember(m.id);
  res.json({ ok: true });
});

// Reset a member's password; returns a one-time temporary password for the admin to share.
app.post('/api/members/:id/password', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!m.email) return res.status(400).json({ error: 'Member needs an email to sign in' });
  syncUsername(m.id, m.email);
  const pw = randomPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change = 1 WHERE member_id = ?').run(hashPassword(pw), m.id);
  res.json({ username: m.email, password: pw });
});

app.post('/api/import', requireAdmin, (req, res) => {
  const m = /^data:[^;]*;base64,(.+)$/.exec(String(req.body?.dataUrl || ''));
  if (!m) return res.status(400).json({ error: 'Invalid file' });
  try {
    res.json(importWorkbook(Buffer.from(m[1], 'base64'), { overwrite: !!req.body.overwrite }));
  } catch (e) {
    res.status(400).json({ error: `Import failed: ${e.message}` });
  }
});

app.get('/api/export.csv', requireAdmin, (req, res) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [FIELDS.map((f) => esc(`${f.kh} / ${f.en}`)).join(',')];
  for (const m of listMembers()) lines.push(FIELDS.map((f) => esc(m[f.key])).join(','));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="aisarc-members.csv"' });
  res.send('\uFEFF' + lines.join('\r\n'));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- static SPA ----------
// Images cache for a day (URLs are versioned); HTML/JS/CSS revalidate (ETag) so deploys show up immediately.
app.use(express.static(PUBLIC, {
  index: false,
  setHeaders: (res, file) => res.set('Cache-Control', /\.(png|jpe?g|webp|svg)$/.test(file) ? 'public, max-age=86400' : 'no-cache'),
}));
app.get(/.*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`AISARC membership running on http://localhost:${PORT}`));
