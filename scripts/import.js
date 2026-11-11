// Usage: node scripts/import.js <file.xlsx> [--overwrite]
import fs from 'node:fs';
import { importWorkbook } from '../server/importer.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import.js <file.xlsx> [--overwrite]');
  process.exit(1);
}
const r = importWorkbook(fs.readFileSync(file), { overwrite: process.argv.includes('--overwrite') });
console.log(`Imported: ${r.inserted} new, ${r.updated} updated, ${r.skipped} skipped (already exist)`);
