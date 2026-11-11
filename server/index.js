import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS, FIELD_MAP, canEdit } from '../public/fields.js';
import { db, UPLOAD_DIR, getMember, listMembers, saveMember, deleteMember } from './db.js';
import {
  hashPassword, verifyPassword, setSession, clearSession, requireUser, requireAdmin,
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

function pick(body, role) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    const f = FIELD_MAP[k];
    if (!f || !canEdit(f, role) || ['file', 'photo'].includes(f.type)) continue;
    let val = String(v ?? '').trim().slice(0, 2000);
    if (f.upper) val = val.toUpperCase();
    if (f.type === 'email') val = val.toLowerCase();
    if (f.type === 'datetime' && val) {
      const d = new Date(val);
      if (isNaN(d)) continue;
      val = d.toISOString();
    }
    out[k] = val;
  }
  return out;
}

function validate(rec, existing = {}) {
  for (const f of FIELDS) if (f.required && !(rec[f.key] ?? existing[f.key])) return `${f.en} is required`;
  if (rec.email) {
    const other = db.prepare('SELECT id FROM members WHERE lower(email)=lower(?) AND id != ?').get(rec.email, existing.id || 0);
    if (other) return 'Email is already used by another member';
  }
  if (rec.member_no) {
    const other = db.prepare('SELECT id FROM members WHERE member_no = ? AND id != ?').get(rec.member_no, existing.id || 0);
    if (other) return 'Membership no. is already used';
  }
  return null;
}

// Keep the login username in sync when the admin changes a member's email.
function syncUsername(memberId, email) {
  if (!email) return;
  const u = db.prepare('SELECT id FROM users WHERE member_id = ?').get(memberId);
  const clash = db.prepare('SELECT id FROM users WHERE username = ? AND member_id IS NOT ?').get(email, memberId);
  if (clash) return;
  if (u) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(email, u.id);
  else db.prepare("INSERT INTO users (username, role, member_id) VALUES (?, 'member', ?)").run(email, memberId);
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

app.post('/api/login/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google sign-in is not configured' });
  const email = await verifyGoogleToken(String(req.body?.credential || ''), GOOGLE_CLIENT_ID).catch(() => null);
  if (!email) return res.status(401).json({ error: 'Google sign-in failed' });
  let u;
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    u = db.prepare("SELECT * FROM users WHERE username = ? AND role = 'admin'").get(email);
    if (!u) {
      const id = db.prepare("INSERT INTO users (username, role) VALUES (?, 'admin')").run(email).lastInsertRowid;
      u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
  } else {
    const m = db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').get(email);
    if (!m) return res.status(403).json({ error: `${email} is not registered as an AISARC member. Please contact the admin.` });
    syncUsername(m.id, email.toLowerCase());
    u = db.prepare('SELECT * FROM users WHERE member_id = ?').get(m.id);
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
  saveMember(existing.id, rec);
  res.json({ member: getMember(existing.id) });
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
app.post('/api/upload', requireUser, (req, res) => {
  const { field, dataUrl, memberId } = req.body || {};
  const f = FIELD_MAP[field];
  if (!f || !['file', 'photo'].includes(f.type)) return res.status(400).json({ error: 'Invalid field' });
  const id = req.user.role === 'admin' && memberId ? Number(memberId) : req.user.member_id;
  const existing = id && getMember(id);
  if (!existing) return res.status(404).json({ error: 'Member not found' });
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  const ext = m && MIME_EXT[m[1]];
  if (!ext || (f.type === 'photo' && ext === 'pdf')) return res.status(400).json({ error: 'Unsupported file type' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'File too large (max 8MB)' });
  const name = `${id}-${field}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  const old = existing[field];
  if (old?.startsWith('file:')) fs.rm(path.join(UPLOAD_DIR, path.basename(old.slice(5))), { force: true }, () => {});
  saveMember(id, { [field]: `file:${name}` });
  res.json({ member: getMember(id) });
});

app.get('/api/files/:name', requireUser, (req, res) => {
  const name = path.basename(req.params.name);
  const ownerId = Number(name.split('-')[0]);
  if (req.user.role !== 'admin' && req.user.member_id !== ownerId) return res.status(403).end();
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400').sendFile(file);
});

// ---------- admin ----------
app.get('/api/fields', (req, res) => res.json(FIELDS));

app.get('/api/members', requireAdmin, (req, res) => res.json(listMembers(req.query.q)));

app.get('/api/members/:id', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  m ? res.json(m) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/members', requireAdmin, (req, res) => {
  const rec = pick(req.body, 'admin');
  const err = validate(rec);
  if (err) return res.status(400).json({ error: err });
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
  saveMember(existing.id, rec);
  if (rec.email) syncUsername(existing.id, rec.email);
  res.json(getMember(existing.id));
});

app.delete('/api/members/:id', requireAdmin, (req, res) => {
  deleteMember(Number(req.params.id));
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
// Images cache for a day; HTML/JS/CSS revalidate (ETag) so new deploys show up immediately.
app.use(express.static(PUBLIC, {
  index: false,
  setHeaders: (res, file) => res.set('Cache-Control', /\.(png|jpe?g|webp|svg)$/.test(file) ? 'public, max-age=86400' : 'no-cache'),
}));
app.get(/.*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`AISARC membership running on http://localhost:${PORT}`));
