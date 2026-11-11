import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from './db.js';

const SECRET = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, '.session-secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
})();

const COOKIE = 'aisarc_session';
const MAX_AGE = 30 * 24 * 3600;
const SECURE = process.env.COOKIE_SECURE === 'true';

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [, salt, hash] = stored.split('$');
  const h = crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

export function setSession(res, user) {
  const payload = b64(JSON.stringify({ uid: user.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: MAX_AGE * 1000, path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
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
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (exp < Date.now() / 1000) return null;
    return db.prepare('SELECT id, username, role, member_id, must_change FROM users WHERE id = ?').get(uid) || null;
  } catch {
    return null;
  }
}

export const requireUser = (req, res, next) => {
  req.user = sessionUser(req);
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
};

export const requireAdmin = (req, res, next) => {
  req.user = sessionUser(req);
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// Simple in-memory brute-force protection: 10 failed attempts per IP+username / 15 min.
const attempts = new Map();
export function loginLimited(key) {
  const a = attempts.get(key);
  return a && a.count >= 10 && Date.now() - a.first < 15 * 60e3;
}
export function loginFailed(key) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > 15 * 60e3) attempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
}
export const loginOk = (key) => attempts.delete(key);

export async function verifyGoogleToken(credential, clientId) {
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) return null;
  const t = await r.json();
  const issOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  if (t.aud !== clientId || !issOk || t.email_verified !== 'true' || Number(t.exp) < Date.now() / 1000) return null;
  return t.email;
}

export function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join('');
}
