import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { db, DATA_DIR } from './db.js';

const scryptAsync = promisify(crypto.scrypt);

const SECRET = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, '.session-secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
})();

const COOKIE = 'aisarc_session';
const MAX_AGE = 14 * 24 * 3600;
// Secure cookies by default whenever the site is served over https.
export const SECURE = process.env.COOKIE_SECURE === 'true'
  || (process.env.COOKIE_SECURE !== 'false'
    && [process.env.PUBLIC_URL, process.env.GOOGLE_REDIRECT_URI].some((u) => /^https:/i.test(u || '')));

// ---------- password hashing (scrypt, parameters stored with the hash) ----------
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;
const MAX_PW = 256;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw).slice(0, MAX_PW), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt2$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function parseHash(stored) {
  const p = String(stored || '').split('$');
  if (p[0] === 'scrypt2' && p.length === 6) return { N: +p[1], r: +p[2], p: +p[3], salt: p[4], hash: p[5] };
  if (p[0] === 'scrypt' && p.length === 3) return { N: 16384, r: 8, p: 1, salt: p[1], hash: p[2] }; // legacy format
  return null;
}

// Async so password checks never block the server; never throws on malformed hashes.
export async function verifyPassword(pw, stored) {
  const h = parseHash(stored);
  try {
    const salt = Buffer.from(h ? h.salt : '00', 'hex');
    const expected = Buffer.from(h ? h.hash : '00'.repeat(KEYLEN), 'hex');
    if (!h || expected.length !== KEYLEN || ![N, 16384].includes(h.N) || h.r !== R || h.p !== P) {
      // Same work as a real check so response time does not reveal whether an account exists.
      await scryptAsync('x', 'dummy-salt-value', KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
      return false;
    }
    const got = await scryptAsync(String(pw).slice(0, MAX_PW), salt, KEYLEN, { N: h.N, r: h.r, p: h.p, maxmem: MAXMEM });
    return crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
export const needsRehash = (stored) => parseHash(stored)?.N !== N;

// ---------- sessions ----------
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

// Global version: bumping it (e.g. after a database restore) signs everyone out.
export function sessionVersion() {
  return Number(db.prepare("SELECT value FROM settings WHERE key = 'session_version'").get()?.value || 0);
}
export function bumpSessionVersion(min = 0) {
  const v = Math.max(sessionVersion(), min) + 1;
  db.prepare("INSERT INTO settings (key, value) VALUES ('session_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(v));
}
// Per-user version: bumping it signs that user out on every device.
export function revokeUserSessions(userId) {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
}

export function setSession(res, user) {
  const tv = db.prepare('SELECT token_version FROM users WHERE id = ?').get(user.id)?.token_version ?? 0;
  const payload = b64(JSON.stringify({ uid: user.id, v: sessionVersion(), tv, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: MAX_AGE * 1000, path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: SECURE });
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) { try { return decodeURIComponent(v.join('=')); } catch { return null; } }
  }
  return null;
}

export function sessionUser(req) {
  const tok = readCookie(req);
  if (!tok) return null;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { uid, v = 0, tv = 0, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (exp < Date.now() / 1000 || v !== sessionVersion()) return null;
    const u = db.prepare('SELECT id, username, email, role, member_id, must_change, token_version FROM users WHERE id = ?').get(uid);
    return u && u.token_version === tv ? u : null;
  } catch {
    return null;
  }
}

// While a temporary password is in use, only these calls are allowed (enforced server side).
const MUST_CHANGE_ALLOWED = new Set(['GET /api/me', 'POST /api/me/password', 'GET /api/config']);

function guard(req, res, next, roles) {
  req.user = sessionUser(req);
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  if (req.user.must_change && !MUST_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, '')))
    return res.status(403).json({ error: 'Please set a new password first', must_change: true });
  if (roles && !roles.includes(req.user.role)) return res.status(403).json({ error: roles.length === 1 ? 'Admin only' : 'Moderator or admin only' });
  next();
}
export const requireUser = (req, res, next) => guard(req, res, next);
export const requireAdmin = (req, res, next) => guard(req, res, next, ['admin']);
export const requireStaff = (req, res, next) => guard(req, res, next, ['admin', 'moderator']);

// ---------- rate limiting (in memory, self-pruning) ----------
const WINDOW = 15 * 60e3;
const buckets = new Map();
function hit(key) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.first > WINDOW) buckets.set(key, { count: 1, first: now });
  else b.count++;
}
const count = (key) => {
  const b = buckets.get(key);
  return b && Date.now() - b.first <= WINDOW ? b.count : 0;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.first > WINDOW) buckets.delete(k);
}, 60e3).unref();

// Limits apply per IP and per account, so changing IP (or forging headers) does not help.
const LIMITS = { ip: 30, user: 10, register: 5 };
export function loginLimited(ip, username) {
  return count(`ip|${ip}`) >= LIMITS.ip || count(`user|${String(username).toLowerCase()}`) >= LIMITS.user;
}
export function loginFailed(ip, username) {
  hit(`ip|${ip}`);
  hit(`user|${String(username).toLowerCase()}`);
}
export const loginOk = (ip, username) => buckets.delete(`user|${String(username).toLowerCase()}`);
export const registerLimited = (ip) => count(`reg|${ip}`) >= LIMITS.register;
export const registerHit = (ip) => hit(`reg|${ip}`);

// ---------- Google ----------
export async function verifyGoogleToken(credential, clientId) {
  if (!credential || credential.length > 4096) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const t = await r.json();
  const issOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  if (t.aud !== clientId || !issOk || t.email_verified !== 'true' || Number(t.exp) < Date.now() / 1000) return null;
  return { email: String(t.email), name: String(t.name || '').slice(0, 200) };
}

export function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[crypto.randomInt(chars.length)]).join('');
}
