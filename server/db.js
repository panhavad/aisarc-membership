import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PROVINCE_FIELDS, PROVINCE_OPTIONS } from '../public/fields.js';
import { provinceOf } from '../public/provinces.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
// Names of files this app creates: member photo/certificate, association QR, event payment bills.
export const UPLOAD_NAME = /^(\d+-(photo|cert_file)|assoc-qr|ev\d+-\d+-bill)-[0-9a-f]+\.(jpg|png|webp|pdf)$/;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'aisarc.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_no TEXT UNIQUE,
    email TEXT,
    joined_at TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS members_email ON members(lower(email));
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    must_change INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    description TEXT,
    seats INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS event_participants (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (event_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    changes TEXT NOT NULL,
    previous TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    decided_by TEXT,
    decided_at TEXT,
    reason TEXT
  );
  CREATE INDEX IF NOT EXISTS change_requests_member ON change_requests(member_id, status);
`);

// Column additions for databases created by earlier versions.
for (const [table, col, def] of [
  ['users', 'token_version', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'temp_expires', 'TEXT'],
  ['users', 'email', 'TEXT'], // optional sign-in email for stand-alone admin / moderator accounts
  ['events', 'map_url', 'TEXT'],
  ['events', 'price', 'REAL NOT NULL DEFAULT 0'],
  ['events', 'close_days', 'INTEGER NOT NULL DEFAULT 0'],
  ['event_participants', 'bill', 'TEXT'],
  ['event_participants', 'bill_at', 'TEXT'],
]) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(lower(email)) WHERE email IS NOT NULL');

const now = () => new Date().toISOString();

// ---------- association settings ----------
const ASSOC_DEFAULTS = {
  name_kh: 'សមាគម គិលានុបដ្ឋាកឯកទេសដាក់ថ្នាំសណ្តំ និង ប្រពោធនកម្មកម្ពុជា',
  name_en: 'AISARC',
  fee: '',
  term_months: '12',
  bank_name: 'ABA Bank',
  account_name: 'Leangsim MENG',
  account_no: '500 076 613',
  currency: 'USD',
};

export function getAssociation() {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'association'").get();
  return { ...ASSOC_DEFAULTS, ...(r ? JSON.parse(r.value) : {}) };
}

export function saveAssociation(patch) {
  const v = { ...getAssociation(), ...patch };
  db.prepare("INSERT INTO settings (key, value) VALUES ('association', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(v));
  return v;
}

export function termMonths() {
  const n = parseInt(getAssociation().term_months, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---------- system settings (admin) ----------
export const DEFAULT_LEVELS = [
  { key: 'member', kh: 'សមាជិក', en: 'Member', color: '' }, // '' = logo blue card
  { key: 'leader', kh: 'ថ្នាក់ដឹកនាំ', en: 'Leader', color: '#a16207' },
  { key: 'board', kh: 'សមាជិកក្រុមប្រឹក្សាភិបាល', en: 'Board member', color: '#6d28d9' },
  { key: 'accounting', kh: 'គណនេយ្យ', en: 'Accounting', color: '#047857' },
];
const SETTINGS_DEFAULTS = {
  edit_days: '30', // members may edit their own information for N days after approval ('' = always)
  renewal_enabled: false, // every year on renewal_date all memberships need renewal (become PENDING)
  renewal_date: '01-01', // MM-DD
  inactive_enabled: false, // PENDING for inactive_years in a row => INACTIVE automatically
  inactive_years: '2',
  levels: DEFAULT_LEVELS,
};

export function getSettings() {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'system'").get();
  const s = { ...SETTINGS_DEFAULTS, ...(r ? JSON.parse(r.value) : {}) };
  if (!Array.isArray(s.levels) || !s.levels.some((l) => l.key === 'member')) s.levels = [DEFAULT_LEVELS[0], ...(s.levels || [])];
  return s;
}

export function saveSettings(s) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('system', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(s));
  return getSettings();
}

export function addMonths(iso, months) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// Midnight (Asia/Phnom_Penh, UTC+7) of month-day in a given year.
const renewalAt = (year, mmdd) => {
  const [mm, dd] = mmdd.split('-').map(Number);
  return new Date(Date.UTC(year, mm - 1, dd) - 7 * 3600e3);
};
const GRACE_DAYS = 60;
// First renewal date after `since`. People approved shortly before the renewal date (within 60 days)
// stay valid until the following year, so a late payment is not wasted.
export function nextRenewal(since, mmdd) {
  const s = new Date(since);
  if (isNaN(s)) return null;
  // Count years explicitly: renewalAt() for 1 Jan is 31 Dec in UTC, so its UTC year can't be used to step.
  let year = s.getUTCFullYear() - 1;
  let d = renewalAt(year, mmdd);
  while (d <= s) d = renewalAt(++year, mmdd);
  if (d - s < GRACE_DAYS * 864e5) d = renewalAt(++year, mmdd);
  return d.toISOString();
}

// Everything needed to derive a member's validity/status, computed once per request.
export function memberContext() {
  const s = getSettings();
  return {
    term: termMonths(),
    renewal: s.renewal_enabled && /^\d{2}-\d{2}$/.test(s.renewal_date) ? s.renewal_date : null,
    editDays: s.edit_days === '' || s.edit_days == null ? null : Math.max(0, parseInt(s.edit_days, 10) || 0),
    levels: s.levels,
  };
}

// Normalise free-text numbers like "១២ឆ្នាំ" or "13 years" -> "12" / "13".
export function toNumberText(v) {
  const s = String(v ?? '').replace(/[០-៩]/g, (c) => String(c.charCodeAt(0) - 0x17e0));
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

// One-off data migrations: "experience" became a number; per-member "payment" moved to Association Info;
// place of birth / current address became a province (the original free text is kept in legacy_text for admins).
for (const r of db.prepare('SELECT id, data FROM members').all()) {
  const d = JSON.parse(r.data);
  let changed = false;
  if (d.experience && !/^\d+(\.\d+)?$/.test(d.experience)) { d.experience = toNumberText(d.experience); changed = true; }
  if ('payment' in d) { delete d.payment; changed = true; }
  for (const k of PROVINCE_FIELDS) {
    if (!d[k] || PROVINCE_OPTIONS.includes(d[k])) continue;
    const p = provinceOf(d[k]);
    if (!p) continue;
    d.legacy_text = { ...(d.legacy_text || {}), [k]: d[k] };
    d[k] = p;
    changed = true;
  }
  if (changed) db.prepare('UPDATE members SET data = ? WHERE id = ?').run(JSON.stringify(d), r.id);
}

// When the current validity period started: last renewal/activation, first approval, or joining.
export const activeSince = (m) => m.renewed_at || m.approved_at || m.joined_at || null;

// Valid-until date:
//  - annual renewal date enabled  → the next renewal date after the membership became active;
//  - otherwise explicit expires_at, or joined_at + membership term (if a term is configured).
export function expiryOf(m, ctx = memberContext()) {
  if (ctx.renewal && activeSince(m)) return nextRenewal(activeSince(m), ctx.renewal);
  if (m.expires_at) return m.expires_at;
  if (!ctx.term || !m.joined_at) return null;
  return addMonths(m.joined_at, ctx.term);
}

// Members may edit their own information for `editDays` after approval; after that it is locked
// and changes go through a change request. Applicants (never approved) can always edit.
export function lockOf(m, ctx) {
  if (ctx.editDays === null || !m.member_no) return { locked: false, until: null };
  const from = m.approved_at || m.joined_at;
  if (!from) return { locked: false, until: null };
  const until = new Date(new Date(from).getTime() + ctx.editDays * 864e5).toISOString();
  return { locked: new Date(until) <= new Date(), until };
}

export function rowToMember(r, ctx = memberContext()) {
  if (!r) return null;
  const data = JSON.parse(r.data || '{}');
  const m = { id: r.id, ...data, member_no: r.member_no, email: r.email, joined_at: r.joined_at, username: r.username ?? undefined, role: r.role ?? undefined };
  m.expires_at = expiryOf(m, ctx);
  m.status = m.status || 'ACTIVE';
  m.level = m.level || 'member';
  // An active membership past its expiry date becomes PENDING until renewed.
  if (m.status === 'ACTIVE' && m.expires_at && new Date(m.expires_at) < new Date()) {
    m.status = 'PENDING';
    m.pending_since = m.expires_at;
  }
  m.lock = lockOf(m, ctx);
  return m;
}

export function getMember(id, ctx) {
  return rowToMember(db.prepare(
    'SELECT m.*, u.username, u.role FROM members m LEFT JOIN users u ON u.member_id = m.id WHERE m.id = ?').get(id), ctx);
}

export function findMemberByEmail(email) {
  return db.prepare('SELECT * FROM members WHERE lower(email) = lower(?)').get(String(email || '').trim());
}

export function listMembers(q = '') {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const ctx = memberContext();
  return db.prepare(`SELECT m.*, u.username, u.role FROM members m LEFT JOIN users u ON u.member_id = m.id
    WHERE ? = '%%' OR lower(m.data) LIKE ? OR lower(ifnull(m.email,'')) LIKE ? OR lower(ifnull(m.member_no,'')) LIKE ?
    ORDER BY m.joined_at IS NULL DESC, m.joined_at DESC, m.id DESC`).all(term, term, term, term).map((r) => rowToMember(r, ctx));
}

// ---------- possible duplicates ----------
// Same phone (any format), same email (incl. emails of duplicate imports), same Latin or Khmer name.
const normPhone = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('855')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  return d.length >= 8 ? d : '';
};
const normName = (v) => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const DUP_REASON = { phone: 'same phone', email: 'same email', name_en: 'same Latin name', name_kh: 'same Khmer name' };

export function duplicateMap(members = listMembers()) {
  const groups = new Map();
  const add = (kind, value, m) => {
    if (!value) return;
    const k = `${kind}:${value}`;
    if (!groups.has(k)) groups.set(k, []);
    if (!groups.get(k).includes(m)) groups.get(k).push(m);
  };
  for (const m of members) {
    add('phone', normPhone(m.phone), m);
    add('phone', normPhone(m.telegram), m);
    add('email', String(m.email || '').toLowerCase(), m);
    add('email', String(m.duplicate_email || '').toLowerCase(), m);
    const en = normName(m.name_en);
    if (en.length >= 4) add('name_en', en, m);
    const kh = normName(m.name_kh).replace(/\s/g, '');
    if (kh.length >= 3) add('name_kh', kh, m);
  }
  const out = new Map();
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    const reason = DUP_REASON[k.split(':')[0]];
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        if ((a.dup_ok || []).includes(b.id) || (b.dup_ok || []).includes(a.id)) continue;
        if (!out.has(a.id)) out.set(a.id, new Map());
        const e = out.get(a.id).get(b.id) || { id: b.id, member_no: b.member_no || null, name_kh: b.name_kh || '', name_en: b.name_en || '', reasons: [] };
        if (!e.reasons.includes(reason)) e.reasons.push(reason);
        out.get(a.id).set(b.id, e);
      }
    }
  }
  return new Map([...out].map(([id, m]) => [id, [...m.values()]]));
}

export function nextMemberNo() {
  const r = db.prepare("SELECT member_no FROM members WHERE member_no LIKE 'AISARC-%' ORDER BY member_no DESC LIMIT 1").get();
  const n = r ? parseInt(r.member_no.slice(7), 10) + 1 : 1;
  return `AISARC-${String(n).padStart(4, '0')}`;
}

const COLUMNS = ['member_no', 'email', 'joined_at'];

// New applicants (status REVIEW) get no membership no. / join date until they are approved.
export function saveMember(id, fields) {
  const cur = id ? db.prepare('SELECT * FROM members WHERE id = ?').get(id) : null;
  if (id && !cur) return null;
  const data = cur ? JSON.parse(cur.data) : {};
  const cols = cur ? { member_no: cur.member_no, email: cur.email, joined_at: cur.joined_at } : {};
  for (const [k, v] of Object.entries(fields)) {
    if (COLUMNS.includes(k)) cols[k] = v === '' ? null : v;
    else data[k] = v;
  }
  if (!data.status) data.status = 'ACTIVE';
  if (!['REVIEW', 'REJECTED', 'DRAFT'].includes(data.status)) {
    if (!cols.member_no) cols.member_no = nextMemberNo();
    if (!cols.joined_at) cols.joined_at = now();
  }
  // node:sqlite cannot bind `undefined` (Node 24), so missing values must be stored as NULL.
  const vals = [cols.member_no ?? null, cols.email ?? null, cols.joined_at ?? null, JSON.stringify(data), now()];
  if (cur) {
    db.prepare('UPDATE members SET member_no=?, email=?, joined_at=?, data=?, updated_at=? WHERE id=?').run(...vals, id);
    return id;
  }
  const r = db.prepare('INSERT INTO members (member_no, email, joined_at, data, updated_at) VALUES (?,?,?,?,?)').run(...vals);
  return Number(r.lastInsertRowid);
}

export function deleteMember(id) {
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
}
