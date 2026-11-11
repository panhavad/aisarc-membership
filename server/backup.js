import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { db, DATA_DIR, UPLOAD_DIR } from './db.js';
import { sessionVersion, bumpSessionVersion } from './auth.js';

// Tables in dependency order (parents first).
const TABLES = ['members', 'users', 'settings', 'events', 'event_participants'];
const FORMAT = 'aisarc-backup';
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Whole database + uploaded files as gzipped JSON.
export function createBackup() {
  const tables = Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()]));
  const files = {};
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    const p = path.join(UPLOAD_DIR, name);
    if (fs.statSync(p).isFile()) files[name] = fs.readFileSync(p).toString('base64');
  }
  const doc = { format: FORMAT, version: 1, created_at: new Date().toISOString(), tables, files };
  return zlib.gzipSync(Buffer.from(JSON.stringify(doc)));
}

const userErr = (msg) => Object.assign(new Error(msg), { userMessage: msg });
const MAX_UNZIPPED = 1024 * 1024 * 1024; // 1 GB cap protects against "zip bomb" files

function parseBackup(buf) {
  let json;
  try {
    const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf, { maxOutputLength: MAX_UNZIPPED }) : buf;
    json = JSON.parse(raw.toString('utf8'));
  } catch {
    throw userErr('Not a valid AISARC backup file');
  }
  if (json?.format !== FORMAT || typeof json.tables !== 'object' || json.tables === null) throw userErr('Not a valid AISARC backup file');
  for (const t of ['members', 'users']) if (!Array.isArray(json.tables[t])) throw userErr(`Backup is missing table "${t}"`);
  if (!json.tables.users.some((u) => u?.role === 'admin')) throw userErr('Backup has no admin account – refusing to restore');
  if (json.files != null && typeof json.files !== 'object') throw userErr('Not a valid AISARC backup file');
  return json;
}

// Replaces ALL data with the backup. A safety backup of the current data is written first.
export function restoreBackup(buf) {
  const doc = parseBackup(buf);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const safety = path.join(BACKUP_DIR, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`);
  fs.writeFileSync(safety, createBackup());

  const oldVersion = sessionVersion();
  const counts = {};
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    for (const t of [...TABLES].reverse()) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('members','users','events')");
    for (const t of TABLES) {
      const cols = new Set(db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name));
      const rows = (doc.tables[t] || []).filter((r) => r && typeof r === 'object');
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.has(k));
        db.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
          .run(...keys.map((k) => row[k] ?? null));
      }
      counts[t] = rows.length;
    }
    // Sign everyone out: old session cookies could otherwise point at different restored accounts.
    bumpSessionVersion(oldVersion);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('[restore]', e);
    throw userErr('Restore failed – the backup data is invalid. Nothing was changed.');
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }

  // Replace uploaded files with the ones from the backup (only names this app itself creates).
  const keep = new Set();
  for (const [name, b64] of Object.entries(doc.files || {})) {
    const safe = path.basename(name);
    if (!/^(\d+-(photo|cert_file)|assoc-qr)-[0-9a-f]+\.(jpg|png|webp|pdf)$/.test(safe) || typeof b64 !== 'string') continue;
    fs.writeFileSync(path.join(UPLOAD_DIR, safe), Buffer.from(b64, 'base64'));
    keep.add(safe);
  }
  for (const name of fs.readdirSync(UPLOAD_DIR)) if (!keep.has(name)) fs.rmSync(path.join(UPLOAD_DIR, name), { force: true });
  counts.files = keep.size;
  return { counts, created_at: doc.created_at, safety_backup: path.basename(safety) };
}
