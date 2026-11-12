import * as XLSX from 'xlsx';
import { FIELDS } from '../public/fields.js';
import { db, findMemberByEmail, saveMember, toNumberText } from './db.js';

const clean = (v) => String(v ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

// Google Forms timestamp "M/D/YYYY H:mm:ss" (Cambodia time, UTC+7) -> ISO string
export function parseTimestamp(s) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, mo, d, y, h = '0', mi = '0', se = '0'] = m;
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${mi}:${pad(se)}+07:00`).toISOString();
}

const normalizers = {
  tshirt: (v) => v.replace(/^size\s*/i, '').toUpperCase(),
  nationality: (v) => (/^(khmer|ខ្ឦែរ)$/i.test(v) ? 'ខ្មែរ' : v),
  name_en: (v) => v.toUpperCase(),
  email: (v) => v.toLowerCase(),
  experience: toNumberText,
};

export function importWorkbook(buffer, { overwrite = false } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const result = { inserted: 0, updated: 0, skipped: 0 };
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role, member_id, must_change) VALUES (?,?,?,?,0)');

  db.exec('BEGIN');
  try {
    for (const row of rows.slice(1)) {
      if (!clean(row[0]) && !clean(row[1])) continue;
      const rec = {};
      for (const f of FIELDS) {
        if (f.col === undefined) continue;
        let v = clean(row[f.col]);
        if (normalizers[f.key]) v = normalizers[f.key](v);
        rec[f.key] = v;
      }
      rec.joined_at = parseTimestamp(row[0]) || new Date().toISOString();
      // Consent was given in the Google Form declaration at submission time.
      if (rec.consent) { rec.consent_at = rec.joined_at; rec.consent_version = 'google-form'; }
      const existing = rec.email ? findMemberByEmail(rec.email) : null;
      if (existing && !overwrite) { result.skipped++; continue; }
      const id = saveMember(existing?.id, rec);
      if (existing) { result.updated++; continue; }
      result.inserted++;
      // No password: members sign in with Google (same email) or get a temporary password from an admin.
      if (rec.email) insertUser.run(rec.email, null, 'member', id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return result;
}
