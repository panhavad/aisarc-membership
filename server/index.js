import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELDS, FIELD_MAP, ASSOC_FIELDS, ROLES, REJECT_REASONS, CONSENT_YES, CONSENT_NO, canEdit, missingForReview,
} from '../public/fields.js';
import {
  db, UPLOAD_DIR, getMember, listMembers, saveMember, deleteMember, getAssociation, saveAssociation,
  termMonths, addMonths, toNumberText,
} from './db.js';
import {
  hashPassword, verifyPassword, needsRehash, setSession, clearSession, requireUser, requireAdmin, requireStaff,
  loginLimited, loginFailed, loginOk, registerLimited, registerHit, verifyGoogleToken, randomPassword,
  revokeUserSessions, sessionUser, SECURE,
} from './auth.js';
import * as XLSX from 'xlsx';
import { createBackup, restoreBackup, purgeOldBackups } from './backup.js';
import { registerEvents } from './events.js';
import { audit, listAudit, memberAudit, purgeAudit } from './audit.js';
import { PRIVACY_VERSION } from '../public/privacy.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const VERSION = JSON.parse(fs.readFileSync(path.join(PUBLIC, '..', 'package.json'), 'utf8')).version;
const PORT = Number(process.env.PORT || 3000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
// Redirect mode is used when a redirect URI is known; otherwise the Google popup is used.
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (PUBLIC_URL ? `${PUBLIC_URL}/auth/google/callback` : '');
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const TEMP_PW_HOURS = 72;

// Bootstrap admin from env only when there is no admin at all (e.g. first start), so a deleted
// admin does not come back on restart. The env password must be changed at first sign-in.
if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD
  && !db.prepare("SELECT id FROM users WHERE role = 'admin'").get()
  && !db.prepare('SELECT id FROM users WHERE username = ?').get(process.env.ADMIN_USERNAME)) {
  db.prepare("INSERT INTO users (username, password_hash, role, must_change) VALUES (?,?,'admin',1)")
    .run(process.env.ADMIN_USERNAME, hashPassword(process.env.ADMIN_PASSWORD));
}

// One-off: remove the old "phone number" first passwords of imported members that were never changed.
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'mig_phone_pw'").get()) {
  const rows = db.prepare(`SELECT u.id, u.password_hash, m.data FROM users u JOIN members m ON m.id = u.member_id
    WHERE u.role = 'member' AND u.must_change = 1 AND u.password_hash IS NOT NULL`).all();
  let cleared = 0;
  for (const r of rows) {
    const d = JSON.parse(r.data);
    for (const ph of [d.phone, d.telegram]) {
      const digits = String(ph || '').replace(/\D/g, '');
      if (digits.length >= 6 && await verifyPassword(digits, r.password_hash)) {
        db.prepare('UPDATE users SET password_hash = NULL, must_change = 0, token_version = token_version + 1 WHERE id = ?').run(r.id);
        cleared++;
        break;
      }
    }
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('mig_phone_pw', ?)").run(String(cleared));
  if (cleared) console.log(`[security] removed ${cleared} phone-number first passwords`);
}

const app = express();
app.disable('x-powered-by');
// Only trust X-Forwarded-For from proxies on loopback / private (Docker) networks, so clients
// cannot forge their IP to dodge rate limits. Override with TRUST_PROXY if needed.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "font-src 'self'",
  "img-src 'self' data: blob: https://drive.google.com https://*.googleusercontent.com",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': CSP,
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  });
  if (SECURE) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
// Mutating API calls must be JSON (or a binary backup upload): both need a CORS preflight
// cross-site, which blocks simple cross-site form posts (CSRF).
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method) || req.is('application/json')) return next();
  if (req.path === '/restore' && req.is('application/octet-stream')) return next();
  res.status(415).json({ error: 'JSON required' });
});
// Large bodies only where files are uploaded (signed-in users); everything else is capped small.
const BIG_JSON = new Set(['/api/upload', '/api/association/qr']);
const jsonSmall = express.json({ limit: '64kb' });
const jsonBig = express.json({ limit: '12mb' });
app.use((req, res, next) => (BIG_JSON.has(req.path) ? jsonBig : jsonSmall)(req, res, next));

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
    const f = Object.hasOwn(FIELD_MAP, k) ? FIELD_MAP[k] : null;
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

// Declaration consent drives the status: "not agree" => INACTIVE; agreeing again => back to review
// (or back to DRAFT for applicants who were never approved, so they still have to submit).
function applyConsent(rec, existing = {}) {
  // Proof of consent: record when it was given or withdrawn, and which privacy notice was current.
  if (rec.consent && rec.consent !== existing.consent) {
    rec.consent_at = nowIso();
    rec.consent_version = PRIVACY_VERSION;
  }
  if (rec.consent === CONSENT_NO) rec.status = 'INACTIVE';
  else if (rec.consent === CONSENT_YES && existing.consent === CONSENT_NO && existing.status === 'INACTIVE' && !rec.status) {
    if (existing.member_no) {
      rec.status = 'REVIEW';
      rec.applied_at = nowIso();
    } else rec.status = 'DRAFT';
  }
}

// Keep the login username in sync with the member's email (admin-controlled).
function syncUsername(memberId, email) {
  if (!email) return;
  const u = db.prepare('SELECT id, username FROM users WHERE member_id = ?').get(memberId);
  const clash = db.prepare('SELECT id FROM users WHERE username = ? AND member_id IS NOT ?').get(email, memberId);
  if (clash) return;
  if (u && u.username.toLowerCase() !== email.toLowerCase()) {
    // A new email has not been proven by its owner yet.
    db.prepare('UPDATE users SET username = ?, email_verified = 0 WHERE id = ?').run(email, u.id);
  } else if (!u) db.prepare("INSERT INTO users (username, role, member_id) VALUES (?, 'member', ?)").run(email, memberId);
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

// New applicants start as DRAFT: they must complete their profile and submit it for review.
function createApplicant({ name_kh = '', name_en = '', email, phone = '' }, passwordHash, emailVerified, privacyAccepted = false) {
  const now = nowIso();
  const id = saveMember(null, {
    name_kh, name_en: name_en.toUpperCase(), email: email.toLowerCase(), phone, consent: CONSENT_YES,
    status: 'DRAFT', registered_at: now, consent_at: now, consent_version: PRIVACY_VERSION,
    ...(privacyAccepted ? { privacy_version: PRIVACY_VERSION, privacy_accepted_at: now } : {}),
  });
  db.prepare("INSERT INTO users (username, password_hash, role, member_id, email_verified) VALUES (?, ?, 'member', ?, ?)")
    .run(email.toLowerCase(), passwordHash, id, emailVerified ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE member_id = ?').get(id);
}

// Errors whose message is safe to show to the user.
class UserError extends Error {}

// ---------- public ----------
app.get('/healthz', (req, res) => res.json({ ok: true, version: VERSION }));
app.get('/api/config', (req, res) => res.json({ version: VERSION, googleClientId: GOOGLE_CLIENT_ID, googleRedirectUri: GOOGLE_REDIRECT_URI }));

app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 200);
  const password = String(req.body?.password || '');
  if (loginLimited(req.ip, username)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const u = username ? db.prepare('SELECT * FROM users WHERE username = ?').get(username) : null;
  const ok = await verifyPassword(password, u?.password_hash); // runs even for unknown users (constant time)
  if (!u || !ok) {
    loginFailed(req.ip, username);
    req.auditActor = username || '(empty)';
    audit(req, 'login.failed');
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (u.must_change && u.temp_expires && new Date(u.temp_expires) < new Date())
    return res.status(401).json({ error: 'This temporary password has expired. Please ask the admin for a new one.' });
  loginOk(req.ip, username);
  if (needsRehash(u.password_hash)) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
  setSession(res, u);
  req.user = u;
  audit(req, 'login', `user:${u.id}`);
  res.json({ user: userPayload(u) });
});

app.post('/api/register', (req, res) => {
  if (registerLimited(req.ip)) return res.status(429).json({ error: 'Too many registrations. Try again later.' });
  registerHit(req.ip); // every attempt counts, including rejected ones
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const name_kh = String(b.name_kh || '').trim().slice(0, 200);
  const name_en = String(b.name_en || '').trim().slice(0, 200);
  const password = String(b.password || '');
  if (!name_kh || !name_en) return res.status(400).json({ error: 'Please enter your name in Khmer and Latin letters' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (password.length < 8 || password.length > 256) return res.status(400).json({ error: 'Password must be 8–256 characters' });
  if (b.consent !== true) return res.status(400).json({ error: 'You must agree to the declaration' });
  if (b.privacy !== true) return res.status(400).json({ error: 'Please read and accept the privacy notice' });
  if (validate({ email, name_kh, name_en }))
    return res.status(400).json({ error: 'This email cannot be registered. If you are already a member, sign in with Google or contact the admin.' });
  const u = createApplicant({ name_kh, name_en, email, phone: String(b.phone || '').trim().slice(0, 50) }, hashPassword(password), false, true);
  setSession(res, u);
  req.user = u;
  audit(req, 'register', `member:${u.member_id}`, { privacy_version: PRIVACY_VERSION });
  res.json({ user: userPayload(u) });
});

// Resolves a verified Google identity to a user (admin, existing member, or new applicant).
// Google proves the person owns the email; any password on a not-yet-verified account was set by
// someone who had not proven ownership, so it is removed and their sessions are revoked.
function googleUser(g) {
  const email = g.email.toLowerCase();
  const claim = (u) => {
    if (!u.email_verified) {
      db.prepare('UPDATE users SET email_verified = 1, password_hash = NULL, must_change = 0, temp_expires = NULL, token_version = token_version + 1 WHERE id = ?').run(u.id);
    }
    return db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  };
  if (ADMIN_EMAILS.includes(email)) {
    const u = db.prepare("SELECT * FROM users WHERE username = ? AND role = 'admin'").get(email);
    if (u) return claim(u);
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(email)) throw new UserError('This account cannot be used for admin sign-in');
    const id = db.prepare("INSERT INTO users (username, role, email_verified) VALUES (?, 'admin', 1)").run(email).lastInsertRowid;
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  const m = db.prepare('SELECT id FROM members WHERE lower(email) = lower(?)').get(email);
  if (m) {
    syncUsername(m.id, email);
    return claim(db.prepare('SELECT * FROM users WHERE member_id = ?').get(m.id));
  }
  // Unknown Google account: register as a new applicant waiting for review.
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(email)) throw new UserError('Account exists, sign in with password');
  return createApplicant({ name_en: g.name, email }, null, true);
}
const safeMessage = (e) => (e instanceof UserError ? e.message : 'Google sign-in failed');

// Popup mode (no PUBLIC_URL): the browser posts the Google credential as JSON.
app.post('/api/login/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'Google sign-in is not configured' });
  if (loginLimited(req.ip, 'google')) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const g = await verifyGoogleToken(String(req.body?.credential || ''), GOOGLE_CLIENT_ID).catch(() => null);
  if (!g) { loginFailed(req.ip, 'google'); return res.status(401).json({ error: 'Google sign-in failed' }); }
  try {
    const u = googleUser(g);
    setSession(res, u);
    req.user = u;
    audit(req, 'login.google', `user:${u.id}`);
    res.json({ user: userPayload(u) });
  } catch (e) { res.status(409).json({ error: safeMessage(e) }); }
});

// Redirect mode: Google posts the credential to GOOGLE_REDIRECT_URI (must be listed in
// "Authorized redirect URIs"). Works inside in-app browsers where popups are blocked.
app.post('/auth/google/callback', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
  const fail = (msg) => res.redirect(303, `/#/login?error=${encodeURIComponent(msg)}`);
  if (!GOOGLE_CLIENT_ID) return fail('Google sign-in is not configured');
  if (loginLimited(req.ip, 'google')) return fail('Too many attempts. Try again later.');
  // Double-submit CSRF check required by Google Identity Services.
  const cookieToken = /(?:^|;\s*)g_csrf_token=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!cookieToken || cookieToken !== req.body?.g_csrf_token) return fail('Google sign-in failed (CSRF check)');
  const g = await verifyGoogleToken(String(req.body?.credential || ''), GOOGLE_CLIENT_ID).catch(() => null);
  if (!g) { loginFailed(req.ip, 'google'); return fail('Google sign-in failed'); }
  try {
    const u = googleUser(g);
    setSession(res, u);
    req.user = u;
    audit(req, 'login.google', `user:${u.id}`);
    res.redirect(303, '/#/');
  } catch (e) { fail(safeMessage(e)); }
});

// Logout signs this account out on every device (revokes all its session cookies).
app.post('/api/logout', (req, res) => {
  const u = sessionUser(req);
  if (u) { revokeUserSessions(u.id); req.user = u; audit(req, 'logout', `user:${u.id}`); }
  clearSession(res);
  res.json({ ok: true });
});

// ---------- signed-in user ----------
app.get('/api/me', requireUser, (req, res) => {
  res.json({ user: userPayload(req.user), member: req.user.member_id ? getMember(req.user.member_id) : null, privacy_version: PRIVACY_VERSION });
});

const changedKeys = (rec, existing) => Object.keys(rec).filter((k) => String(rec[k] ?? '') !== String(existing[k] ?? ''));

app.put('/api/me', requireUser, (req, res) => {
  if (!req.user.member_id) return res.status(400).json({ error: 'No member profile' });
  const existing = getMember(req.user.member_id);
  const rec = pick(req.body, 'member');
  const err = validate(rec, existing);
  if (err) return res.status(400).json({ error: err });
  applyConsent(rec, existing);
  const changed = changedKeys(rec, existing);
  saveMember(existing.id, rec);
  if (changed.length) audit(req, rec.consent && rec.consent !== existing.consent ? 'consent.change' : 'member.self_update', `member:${existing.id}`, { fields: changed });
  res.json({ member: getMember(existing.id) });
});

// Accept the current privacy notice (recorded with version + time as proof).
app.post('/api/me/privacy', requireUser, (req, res) => {
  if (req.body?.accept !== true) return res.status(400).json({ error: 'Accept is required' });
  if (req.user.member_id) saveMember(req.user.member_id, { privacy_version: PRIVACY_VERSION, privacy_accepted_at: nowIso() });
  audit(req, 'privacy.accept', req.user.member_id ? `member:${req.user.member_id}` : `user:${req.user.id}`, { version: PRIVACY_VERSION });
  res.json({ member: req.user.member_id ? getMember(req.user.member_id) : null });
});

// Right of access / portability: everything we hold about the signed-in person, as JSON.
app.get('/api/me/export', requireUser, (req, res) => {
  const u = db.prepare('SELECT id, username, role, email_verified, must_change FROM users WHERE id = ?').get(req.user.id);
  const member = req.user.member_id ? getMember(req.user.member_id) : null;
  const events = req.user.member_id ? db.prepare(`SELECT e.title, e.location, e.starts_at, p.joined_at FROM event_participants p
    JOIN events e ON e.id = p.event_id WHERE p.member_id = ? ORDER BY e.starts_at`).all(req.user.member_id) : [];
  const history = req.user.member_id ? memberAudit(req.user.member_id) : [];
  audit(req, 'data.export_own', req.user.member_id ? `member:${req.user.member_id}` : `user:${req.user.id}`);
  res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="my-aisarc-data.json"' });
  res.send(JSON.stringify({
    exported_at: nowIso(), privacy_notice_version: PRIVACY_VERSION,
    account: u, member, events_joined: events, activity_on_my_record: history,
    note: 'Uploaded photos and certificates can be downloaded from your profile (View buttons).',
  }, null, 2));
});

// Right to erasure: member asks for deletion; admins see the request and must act within 30 days.
app.post('/api/me/deletion', requireUser, (req, res) => {
  if (!req.user.member_id) return res.status(400).json({ error: 'No member profile' });
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  saveMember(req.user.member_id, { deletion_requested_at: nowIso(), deletion_reason: reason });
  audit(req, 'deletion.request', `member:${req.user.member_id}`);
  res.json({ member: getMember(req.user.member_id) });
});
app.delete('/api/me/deletion', requireUser, (req, res) => {
  if (!req.user.member_id) return res.status(400).json({ error: 'No member profile' });
  saveMember(req.user.member_id, { deletion_requested_at: '', deletion_reason: '' });
  audit(req, 'deletion.cancel', `member:${req.user.member_id}`);
  res.json({ member: getMember(req.user.member_id) });
});

// Member submits their application (DRAFT / REJECTED) or renewal (PENDING / INACTIVE) for moderator review.
// Applications must have every required field completed.
app.post('/api/me/submit', requireUser, (req, res) => {
  const m = req.user.member_id && getMember(req.user.member_id);
  if (!m) return res.status(400).json({ error: 'No member profile' });
  if (!['DRAFT', 'REJECTED', 'PENDING', 'INACTIVE'].includes(m.status)) return res.status(400).json({ error: 'Nothing to submit' });
  if (m.consent !== CONSENT_YES) return res.status(400).json({ error: 'Please agree to the declaration in your profile first' });
  if (['DRAFT', 'REJECTED'].includes(m.status)) {
    const missing = missingForReview(m);
    if (missing.length) {
      return res.status(400).json({
        error: `Please complete: ${missing.map((k) => FIELD_MAP[k].en).join(', ')}`,
        missing,
      });
    }
  }
  const err = validate({}, m);
  if (err) return res.status(400).json({ error: err });
  saveMember(m.id, { status: 'REVIEW', applied_at: nowIso() });
  audit(req, 'member.submit', `member:${m.id}`, { from: m.status });
  res.json({ member: getMember(m.id) });
});

// Changing the password signs out all other devices; this device gets a fresh session.
app.post('/api/me/password', requireUser, async (req, res) => {
  const current = String(req.body?.current || '');
  const password = String(req.body?.password || '');
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (u.password_hash && !u.must_change) {
    if (loginLimited(req.ip, u.username)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!(await verifyPassword(current, u.password_hash))) {
      loginFailed(req.ip, u.username);
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
  }
  if (password.length < 8 || password.length > 256) return res.status(400).json({ error: 'Password must be 8–256 characters' });
  db.prepare('UPDATE users SET password_hash = ?, must_change = 0, temp_expires = NULL, token_version = token_version + 1 WHERE id = ?')
    .run(hashPassword(password), u.id);
  setSession(res, u);
  audit(req, 'password.change', `user:${u.id}`);
  res.json({ ok: true });
});

// Upload photo / certificate as a data URL (client resizes photos before sending).
// The file content is checked against its real signature, not just the declared type.
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MAGIC = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  pdf: (b) => b.toString('latin1', 0, 5) === '%PDF-',
};
function storeDataUrl(dataUrl, prefix, allowPdf) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  const ext = m && MIME_EXT[m[1]];
  if (!ext || (!allowPdf && ext === 'pdf')) throw new UserError('Unsupported file type');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw new UserError('File too large (max 8MB)');
  if (!MAGIC[ext](buf)) throw new UserError('File content does not match its type');
  const name = `${prefix}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return name;
}
const removeUpload = (v) => {
  if (v?.startsWith('file:')) fs.rm(path.join(UPLOAD_DIR, path.basename(v.slice(5))), { force: true }, () => {});
};

app.post('/api/upload', requireUser, (req, res) => {
  const { field, dataUrl, memberId } = req.body || {};
  const f = Object.hasOwn(FIELD_MAP, field) ? FIELD_MAP[field] : null;
  if (!f || !['file', 'photo'].includes(f.type)) return res.status(400).json({ error: 'Invalid field' });
  const id = req.user.role === 'admin' && memberId ? Number(memberId) : req.user.member_id;
  const existing = id && getMember(id);
  if (!existing) return res.status(404).json({ error: 'Member not found' });
  try {
    const name = storeDataUrl(dataUrl, `${id}-${field}`, f.type === 'file');
    removeUpload(existing[field]);
    saveMember(id, { [field]: `file:${name}` });
    audit(req, 'file.upload', `member:${id}`, { field });
    res.json({ member: getMember(id) });
  } catch (e) {
    if (!(e instanceof UserError)) console.error(e);
    res.status(400).json({ error: e instanceof UserError ? e.message : 'Upload failed' });
  }
});

app.get('/api/files/:name', requireUser, (req, res) => {
  const name = path.basename(req.params.name);
  if (!/^(\d+-(photo|cert_file)|assoc-qr)-[0-9a-f]+\.(jpg|png|webp|pdf)$/.test(name)) return res.status(404).end();
  const isStaff = ['admin', 'moderator'].includes(req.user.role);
  const isPublic = name.startsWith('assoc-');
  if (!isStaff && !isPublic && req.user.member_id !== Number(name.split('-')[0])) return res.status(403).end();
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  // Certificates are sensitive documents: log when staff open someone else's.
  if (isStaff && name.includes('-cert_file-') && req.user.member_id !== Number(name.split('-')[0])) {
    audit(req, 'file.view', `member:${Number(name.split('-')[0])}`, { field: 'cert_file' });
  }
  // Sandbox served files so a crafted file can never run script on this site.
  res.set({ 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" });
  res.sendFile(file);
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
  audit(req, 'association.update', 'association', { fields: Object.keys(patch) });
  res.json(saveAssociation(patch));
});

app.post('/api/association/qr', requireAdmin, (req, res) => {
  try {
    const name = storeDataUrl(req.body?.dataUrl, 'assoc-qr', false);
    removeUpload(getAssociation().qr);
    res.json(saveAssociation({ qr: `file:${name}` }));
  } catch (e) {
    if (!(e instanceof UserError)) console.error(e);
    res.status(400).json({ error: e instanceof UserError ? e.message : 'Upload failed' });
  }
});

// ---------- staff: moderators + admins ----------
app.get('/api/members', requireStaff, (req, res) => res.json(listMembers(req.query.q)));

app.get('/api/members/:id', requireStaff, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  audit(req, 'member.view', `member:${m.id}`);
  res.json(m);
});

// History of everything done to one member record (admins only).
app.get('/api/members/:id/audit', requireAdmin, (req, res) => res.json(memberAudit(Number(req.params.id))));

app.post('/api/members/:id/review', requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const m = getMember(id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && m.status !== 'REVIEW') return res.status(400).json({ error: 'This member is not waiting for review' });
  const { decision, reason, message = '' } = req.body || {};
  if (decision === 'approve') {
    audit(req, 'member.approve', `member:${id}`);
    return res.json(activate(id, req.user.username));
  }
  if (decision !== 'reject') return res.status(400).json({ error: 'Invalid decision' });
  const r = REJECT_REASONS.find((x) => x.key === reason);
  const msg = String(message).trim().slice(0, 1000);
  if (!r) return res.status(400).json({ error: 'Please choose a reason for rejecting' });
  if (r.key === 'other' && !msg) return res.status(400).json({ error: 'Please write a message explaining the reason' });
  saveMember(id, { status: 'REJECTED', review: { decision: 'rejected', reason: r.key, message: msg, by: req.user.username, at: nowIso() } });
  audit(req, 'member.reject', `member:${id}`, { reason: r.key });
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
  audit(req, 'member.create', `member:${id}`);
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
  const changed = changedKeys(rec, existing);
  saveMember(existing.id, rec);
  if (rec.email) syncUsername(existing.id, rec.email);
  if (changed.length) audit(req, 'member.update', `member:${existing.id}`, { fields: changed });
  if (rec.status === 'ACTIVE') return res.json(activate(existing.id, req.user.username));
  res.json(getMember(existing.id));
});

app.post('/api/members/:id/status', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!getMember(id)) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body || {};
  if (status === 'ACTIVE') { audit(req, 'member.activate', `member:${id}`); return res.json(activate(id, req.user.username)); }
  if (status !== 'INACTIVE') return res.status(400).json({ error: 'Invalid status' });
  saveMember(id, { status: 'INACTIVE' });
  audit(req, 'member.deactivate', `member:${id}`);
  res.json(getMember(id));
});

app.put('/api/members/:id/role', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  const role = String(req.body?.role || '');
  if (!ROLES.some((r) => r.key === role)) return res.status(400).json({ error: 'Invalid role' });
  if (!m.email) return res.status(400).json({ error: 'Member needs an email to sign in' });
  syncUsername(m.id, m.email);
  const u = db.prepare('SELECT * FROM users WHERE member_id = ?').get(m.id);
  if (u.role === 'admin' && role !== 'admin' && (u.id === req.user.id || adminCount() <= 1))
    return res.status(400).json({ error: 'You cannot remove your own admin role or the last admin' });
  db.prepare('UPDATE users SET role = ?, token_version = token_version + 1 WHERE member_id = ?').run(role, m.id);
  audit(req, 'role.change', `member:${m.id}`, { from: u.role, to: role });
  res.json(getMember(m.id));
});

app.delete('/api/members/:id', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (String(req.body?.confirm || '').trim() !== (m.member_no || m.email)) return res.status(400).json({ error: 'Confirmation text does not match' });
  const u = db.prepare('SELECT * FROM users WHERE member_id = ?').get(m.id);
  if (u && (u.id === req.user.id || (u.role === 'admin' && adminCount() <= 1)))
    return res.status(400).json({ error: 'You cannot delete your own account or the last admin' });
  removeUpload(m.photo);
  removeUpload(m.cert_file);
  deleteMember(m.id);
  audit(req, 'member.delete', `member:${m.id}`, { member_no: m.member_no || null, deletion_requested: !!m.deletion_requested_at });
  res.json({ ok: true });
});

const tempExpiry = () => new Date(Date.now() + TEMP_PW_HOURS * 3600e3).toISOString();

// Reset a member's password; returns a one-time temporary password (valid 72h) for the admin to share.
app.post('/api/members/:id/password', requireAdmin, (req, res) => {
  const m = getMember(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (!m.email) return res.status(400).json({ error: 'Member needs an email to sign in' });
  syncUsername(m.id, m.email);
  const pw = randomPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change = 1, temp_expires = ?, token_version = token_version + 1 WHERE member_id = ?')
    .run(hashPassword(pw), tempExpiry(), m.id);
  audit(req, 'password.reset', `member:${m.id}`);
  res.json({ username: m.email, password: pw, expires_hours: TEMP_PW_HOURS });
});

// Excel export of all members, or only the given ids (?ids=1,2,3).
app.get('/api/export.xlsx', requireAdmin, (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const rows = listMembers().filter((m) => !ids.length || ids.includes(m.id));
  audit(req, 'members.export', 'members', { count: rows.length, scope: ids.length ? 'selected' : 'all' });
  const fmt = (f, v) => {
    if (v == null || v === '') return '';
    if (f.type === 'datetime') return new Date(new Date(v).getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
    if (f.type === 'number') return Number(v);
    if ((f.type === 'photo' || f.type === 'file') && String(v).startsWith('file:')) return `${PUBLIC_URL || ''}/api/files/${String(v).slice(5)}`;
    return String(v);
  };
  const header = [...FIELDS.map((f) => `${f.kh} / ${f.en}`), 'Role'];
  const data = rows.map((m) => [...FIELDS.map((f) => fmt(f, m[f.key])), m.role || 'member']);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = header.map((h, i) => ({ wch: Math.min(40, Math.max(12, ...[h, ...data.map((r) => r[i])].map((v) => String(v ?? '').length))) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: header.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="aisarc-members-${ids.length ? 'selected' : 'all'}-${stamp}.xlsx"`,
  });
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
});

// ---------- admin: system users (admins / moderators) ----------
const userView = (u) => ({
  id: u.id, username: u.username, role: u.role, member_id: u.member_id, member_no: u.member_no || null,
  name: u.name || null, has_password: !!u.password_hash,
});

app.get('/api/users', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT u.*, m.member_no, json_extract(m.data, '$.name_kh') AS name FROM users u
    LEFT JOIN members m ON m.id = u.member_id WHERE u.role IN ('admin','moderator') ORDER BY u.role, u.username`).all();
  res.json(rows.map(userView));
});

app.post('/api/users', requireAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const role = req.body?.role;
  if (!/^[\w.@+-]{3,64}$/.test(username)) return res.status(400).json({ error: 'Username: 3–64 letters, numbers or . _ @ + -' });
  if (!['admin', 'moderator'].includes(role)) return res.status(400).json({ error: 'Role must be admin or moderator' });
  if (password.length < 8 || password.length > 256) return res.status(400).json({ error: 'Password must be 8–256 characters' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return res.status(400).json({ error: 'Username already exists' });
  db.prepare('INSERT INTO users (username, password_hash, role, must_change, temp_expires) VALUES (?,?,?,1,?)')
    .run(username, hashPassword(password), role, tempExpiry());
  audit(req, 'user.create', `username:${username}`, { role });
  res.json({ ok: true });
});

const adminCount = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Not found' });
  const role = req.body?.role;
  const allowed = u.member_id ? ['member', 'moderator', 'admin'] : ['moderator', 'admin'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (u.role === 'admin' && role !== 'admin' && (u.id === req.user.id || adminCount() <= 1))
    return res.status(400).json({ error: 'You cannot remove your own admin role or the last admin' });
  db.prepare('UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?').run(role, u.id);
  audit(req, 'role.change', `user:${u.id}`, { from: u.role, to: role });
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Use the key icon to change your own password' });
  const pw = randomPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change = 1, temp_expires = ?, token_version = token_version + 1 WHERE id = ?')
    .run(hashPassword(pw), tempExpiry(), u.id);
  audit(req, 'password.reset', `user:${u.id}`);
  res.json({ username: u.username, password: pw, expires_hours: TEMP_PW_HOURS });
});

// Removing a system user deletes standalone accounts; member accounts are only demoted to "member".
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot remove yourself' });
  if (u.role === 'admin' && adminCount() <= 1) return res.status(400).json({ error: 'Cannot remove the last admin' });
  if (u.member_id) db.prepare("UPDATE users SET role = 'member', token_version = token_version + 1 WHERE id = ?").run(u.id);
  else db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  audit(req, u.member_id ? 'role.change' : 'user.delete', `user:${u.id}`, { username: u.username, from: u.role });
  res.json({ ok: true });
});

// ---------- admin: backup & restore ----------
// POST (not GET) so the optional passphrase never appears in URLs or server logs.
app.post('/api/backup', requireAdmin, (req, res) => {
  const pass = String(req.body?.passphrase || '');
  if (pass && pass.length < 10) return res.status(400).json({ error: 'Passphrase must be at least 10 characters' });
  const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  audit(req, 'backup.download', 'database', { encrypted: !!pass });
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="aisarc-backup-${stamp}${pass ? '.aisarc-enc' : '.json.gz'}"`,
  });
  res.send(createBackup(pass));
});

app.post('/api/restore', requireAdmin, express.raw({ type: 'application/octet-stream', limit: '300mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No file uploaded' });
  try {
    let pass = '';
    try { pass = decodeURIComponent(String(req.get('X-Backup-Passphrase') || '')); } catch { /* treat as no passphrase */ }
    const r = restoreBackup(req.body, pass);
    audit(req, 'backup.restore', 'database', { from: r.created_at, counts: r.counts });
    clearSession(res);
    res.json(r);
  } catch (e) {
    console.error('[restore]', e.userMessage || e);
    res.status(400).json({ error: e.userMessage || 'Restore failed – the file is not a valid AISARC backup. Nothing was changed.' });
  }
});

// ---------- admin: audit log & privacy dashboard ----------
app.get('/api/audit', requireAdmin, (req, res) => {
  res.json(listAudit({ q: req.query.q, before: req.query.before ? Number(req.query.before) : null, limit: req.query.limit }));
});

app.get('/api/privacy/requests', requireAdmin, (req, res) => {
  const rows = listMembers().filter((m) => m.deletion_requested_at)
    .map((m) => ({ id: m.id, member_no: m.member_no, name_kh: m.name_kh, name_en: m.name_en, requested_at: m.deletion_requested_at, reason: m.deletion_reason || '' }));
  res.json(rows);
});

// ---------- retention (runs at start-up and daily) ----------
function retention() {
  const cutoff = new Date(Date.now() - 365 * 864e5).toISOString();
  const stale = db.prepare(`SELECT id FROM members WHERE json_extract(data, '$.status') = 'DRAFT'
    AND ifnull(updated_at, ifnull(json_extract(data, '$.registered_at'), '')) < ?`).all(cutoff);
  for (const { id } of stale) {
    const m = getMember(id);
    removeUpload(m?.photo);
    removeUpload(m?.cert_file);
    deleteMember(id);
  }
  const auditPurged = purgeAudit(730);
  const backupsPurged = purgeOldBackups(90);
  if (stale.length || auditPurged || backupsPurged) {
    audit({ auditActor: 'system' }, 'retention.purge', 'database', { drafts: stale.length, audit: auditPurged, backups: backupsPurged });
  }
}
retention();
setInterval(retention, 24 * 3600e3).unref();

registerEvents(app);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- static SPA ----------
// Images cache for a day (URLs are versioned); HTML/JS/CSS revalidate (ETag) so deploys show up immediately.
app.use(express.static(PUBLIC, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, file) => res.set('Cache-Control', /\.(png|jpe?g|webp|svg|woff2)$/.test(file) ? 'public, max-age=86400' : 'no-cache'),
}));
app.get(/.*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(PUBLIC, 'index.html')));

// Never send internal error details or stack traces to clients.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return;
  const msg = status === 413 ? 'Request too large' : status === 400 ? 'Bad request' : status < 500 ? 'Request rejected' : 'Server error';
  res.status(status).json({ error: msg });
});

app.listen(PORT, () => console.log(`AISARC membership v${VERSION} running on http://localhost:${PORT}`));
