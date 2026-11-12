// Regenerates PRIVACY.md from public/privacy.js (run: node scripts/privacy-md.mjs).
import fs from 'node:fs';
import { PRIVACY, PRIVACY_VERSION } from '../public/privacy.js';

const out = [
  '# Privacy notice · សេចក្តីជូនដំណឹងអំពីឯកជនភាព',
  '',
  `**Version ${PRIVACY_VERSION}** – this is the same text members see in the app (\`/#/privacy\`, source: \`public/privacy.js\`).`,
  'When the text changes, update `PRIVACY_VERSION` so members are asked to accept it again.',
  '',
];
PRIVACY.forEach((s, i) => out.push(`## ${i + 1}. ${s.kh} · ${s.en}`, '', s.khBody, '', s.enBody, ''));
fs.writeFileSync(new URL('../PRIVACY.md', import.meta.url), out.join('\n'));
console.log(`PRIVACY.md written (version ${PRIVACY_VERSION})`);
