// Usage: node scripts/import.js <file.xlsx> [--overwrite]
import fs from 'node:fs';
import { importWorkbook } from '../server/importer.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import.js <file.xlsx> [--overwrite]');
  process.exit(1);
}
const r = importWorkbook(fs.readFileSync(file), { overwrite: process.argv.includes('--overwrite') });
console.log(`Imported: ${r.inserted} new, ${r.updated} updated, ${r.skipped} skipped (already imported)`);
if (r.duplicates) console.log(`${r.duplicates} row(s) reuse an email that already exists – kept as REVIEW records without a login, flagged "Duplicate"`);
if (r.flagged) console.log(`${r.flagged} imported record(s) look like a possible duplicate – check Members → Duplicate filter`);
