import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
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
`);

// Column additions for databases created by earlier versions.
for (const [table, col, def] of [
  ['users', 'token_version', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'temp_expires', 'TEXT'],
]) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

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

export function addMonths(iso, months) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// Normalise free-text numbers like "១២ឆ្នាំ" or "13 years" -> "12" / "13".
export function toNumberText(v) {
  const s = String(v ?? '').replace(/[០-៩]/g, (c) => String(c.charCodeAt(0) - 0x17e0));
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

// One-off data migrations: "experience" became a number; per-member "payment" moved to Association Info.
for (const r of db.prepare('SELECT id, data FROM members').all()) {
  const d = JSON.parse(r.data);
  let changed = false;
  if (d.experience && !/^\d+(\.\d+)?$/.test(d.experience)) { d.experience = toNumberText(d.experience); changed = true; }
  if ('payment' in d) { delete d.payment; changed = true; }
  if (changed) db.prepare('UPDATE members SET data = ? WHERE id = ?').run(JSON.stringify(d), r.id);
}

// Expiry date: explicit expires_at, otherwise joined_at + membership term (if a term is configured).
export function expiryOf(m, term = termMonths()) {
  if (m.expires_at) return m.expires_at;
  if (!term || !m.joined_at) return null;
  return addMonths(m.joined_at, term);
}

export function rowToMember(r, term) {
  if (!r) return null;
  const data = JSON.parse(r.data || '{}');
  const m = { id: r.id, ...data, member_no: r.member_no, email: r.email, joined_at: r.joined_at, username: r.username ?? undefined, role: r.role ?? undefined };
  m.expires_at = expiryOf(m, term);
  m.status = m.status || 'ACTIVE';
  // An active membership past its expiry date becomes PENDING until renewed.
  if (m.status === 'ACTIVE' && m.expires_at && new Date(m.expires_at) < new Date()) m.status = 'PENDING';
  return m;
}

export function getMember(id) {
  return rowToMember(db.prepare(
    'SELECT m.*, u.username, u.role FROM members m LEFT JOIN users u ON u.member_id = m.id WHERE m.id = ?').get(id));
}

export function findMemberByEmail(email) {
  return db.prepare('SELECT * FROM members WHERE lower(email) = lower(?)').get(String(email || '').trim());
}

export function listMembers(q = '') {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const months = termMonths();
  return db.prepare(`SELECT m.*, u.username, u.role FROM members m LEFT JOIN users u ON u.member_id = m.id
    WHERE ? = '%%' OR lower(m.data) LIKE ? OR lower(ifnull(m.email,'')) LIKE ? OR lower(ifnull(m.member_no,'')) LIKE ?
    ORDER BY m.joined_at IS NULL DESC, m.joined_at DESC, m.id DESC`).all(term, term, term, term).map((r) => rowToMember(r, months));
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
  if (data.status !== 'REVIEW' && data.status !== 'REJECTED') {
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
