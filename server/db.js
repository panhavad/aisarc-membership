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
`);

const now = () => new Date().toISOString();

export function rowToMember(r) {
  if (!r) return null;
  const data = JSON.parse(r.data || '{}');
  return { id: r.id, ...data, member_no: r.member_no, email: r.email, joined_at: r.joined_at, username: r.username ?? undefined };
}

export function getMember(id) {
  return rowToMember(db.prepare(
    'SELECT m.*, u.username FROM members m LEFT JOIN users u ON u.member_id = m.id WHERE m.id = ?').get(id));
}

export function findMemberByEmail(email) {
  return db.prepare('SELECT * FROM members WHERE lower(email) = lower(?)').get(String(email || '').trim());
}

export function listMembers(q = '') {
  const term = `%${String(q).trim().toLowerCase()}%`;
  return db.prepare(`SELECT m.*, u.username FROM members m LEFT JOIN users u ON u.member_id = m.id
    WHERE ? = '%%' OR lower(m.data) LIKE ? OR lower(ifnull(m.email,'')) LIKE ? OR lower(ifnull(m.member_no,'')) LIKE ?
    ORDER BY m.joined_at DESC, m.id DESC`).all(term, term, term, term).map(rowToMember);
}

export function nextMemberNo() {
  const r = db.prepare("SELECT member_no FROM members WHERE member_no LIKE 'AISARC-%' ORDER BY member_no DESC LIMIT 1").get();
  const n = r ? parseInt(r.member_no.slice(7), 10) + 1 : 1;
  return `AISARC-${String(n).padStart(4, '0')}`;
}

const COLUMNS = ['member_no', 'email', 'joined_at'];

export function saveMember(id, fields) {
  const cur = id ? db.prepare('SELECT * FROM members WHERE id = ?').get(id) : null;
  if (id && !cur) return null;
  const data = cur ? JSON.parse(cur.data) : {};
  const cols = cur ? { member_no: cur.member_no, email: cur.email, joined_at: cur.joined_at } : {};
  for (const [k, v] of Object.entries(fields)) {
    if (COLUMNS.includes(k)) cols[k] = v === '' ? null : v;
    else data[k] = v;
  }
  if (!cols.member_no) cols.member_no = nextMemberNo();
  if (!cols.joined_at) cols.joined_at = now();
  if (!data.status) data.status = 'ACTIVE';
  if (cur) {
    db.prepare('UPDATE members SET member_no=?, email=?, joined_at=?, data=?, updated_at=? WHERE id=?')
      .run(cols.member_no, cols.email ?? null, cols.joined_at, JSON.stringify(data), now(), id);
    return id;
  }
  const r = db.prepare('INSERT INTO members (member_no, email, joined_at, data, updated_at) VALUES (?,?,?,?,?)')
    .run(cols.member_no, cols.email ?? null, cols.joined_at, JSON.stringify(data), now());
  return Number(r.lastInsertRowid);
}

export function deleteMember(id) {
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
}
