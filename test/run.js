// AISARC end-to-end test suite: features, security and data-protection controls.
// Usage: npm test            → runs everything and writes docs/TEST-REPORT.md
// Starts throw-away server instances with a temporary database; never touches real data.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'docs', 'TEST-REPORT.md');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const BOOT_PW = 'TestAdmin-2026!';
const ADMIN = { username: 'admin', password: BOOT_PW };
const IMG = fs.readFileSync(path.join(ROOT, 'public', 'img', 'icon-192.png'));
const PNG_URL = `data:image/png;base64,${IMG.toString('base64')}`;

// ---------------------------------------------------------------- harness
const results = [];
let current = 'General';
const section = (name) => { current = name; };
async function t(id, title, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ cat: current, id, title, ok: true, ms: Date.now() - start });
    process.stdout.write(`  PASS ${id} ${title}\n`);
  } catch (e) {
    const skip = !!e?.skip;
    // A dead server: include the end of its log so the cause is visible in the report.
    if (/fetch failed/.test(e?.message) && srv?.log) e = new Error(`${e.message} – server log: ${srv.log().slice(-600)}`);
    results.push({ cat: current, id, title, ok: skip ? null : false, ms: Date.now() - start, err: String(e?.message || e).slice(0, 300) });
    process.stdout.write(`  ${skip ? 'SKIP' : 'FAIL'} ${id} ${title}\n      ${e?.message}\n`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ---------------------------------------------------------------- server control
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

async function startServer(dataDir, extraEnv = {}, fixedPort = null) {
  const port = fixedPort || await freePort();
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', NODE_NO_WARNINGS: '1', PORT: String(port), DATA_DIR: dataDir,
      ADMIN_USERNAME: ADMIN.username, ADMIN_PASSWORD: BOOT_PW, COOKIE_SECURE: 'false',
      PUBLIC_URL: '', GOOGLE_CLIENT_ID: '', GOOGLE_REDIRECT_URI: '', ADMIN_EMAILS: '', SESSION_SECRET: '', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return { base, child, log: () => log }; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start:\n${log}`);
}
const stopServer = (s) => new Promise((r) => { if (s.child.exitCode !== null) return r(); s.child.once('exit', r); s.child.kill(); });

// ---------------------------------------------------------------- HTTP client with its own cookie + client IP
// The server trusts X-Forwarded-For from loopback, so each client gets its own IP (like real users).
let ipSeq = 1;
function client(base, ip = `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`) {
  let cookie = '';
  const extra = {}; // other cookies (e.g. the account-chooser cookie)
  const call = async (method, url, body, { headers = {}, raw = false } = {}) => {
    const h = { 'X-Forwarded-For': ip, ...headers };
    const all = [cookie, ...Object.entries(extra).map(([k, v]) => `${k}=${v}`)].filter(Boolean).join('; ');
    if (all && !h.Cookie) h.Cookie = all;
    let payload;
    if (body !== undefined) {
      if (Buffer.isBuffer(body)) { payload = body; h['Content-Type'] ??= 'application/octet-stream'; }
      else if (typeof body === 'string') { payload = body; h['Content-Type'] ??= 'application/x-www-form-urlencoded'; }
      else { payload = JSON.stringify(body); h['Content-Type'] ??= 'application/json'; }
    }
    const r = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' });
    const sc = r.headers.getSetCookie?.() || [];
    for (const c of sc) {
      const m = /^aisarc_session=([^;]*)/.exec(c);
      if (m) { cookie = m[1] ? `aisarc_session=${m[1]}` : ''; continue; }
      const o = /^([\w-]+)=([^;]*)/.exec(c);
      if (o) { if (o[2] && !/expires=Thu, 01 Jan 1970/i.test(c)) extra[o[1]] = o[2]; else delete extra[o[1]]; }
    }
    const buf = Buffer.from(await r.arrayBuffer());
    let json = null;
    if (!raw) { try { json = JSON.parse(buf.toString('utf8')); } catch { /* not json */ } }
    return { status: r.status, headers: r.headers, json, buf, text: buf.toString('utf8'), setCookie: sc };
  };
  return {
    ip,
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
    get: (u, o) => call('GET', u, undefined, o),
    post: (u, b = {}, o) => call('POST', u, b, o),
    put: (u, b = {}, o) => call('PUT', u, b, o),
    del: (u, b = {}, o) => call('DELETE', u, b, o),
  };
}

// ---------------------------------------------------------------- helpers
const iso = (days, hours = 0) => new Date(Date.now() + days * 864e5 + hours * 36e5).toISOString();
const FULL = {
  gender: 'ស្រី', nationality: 'ខ្មែរ', dob: '01/02/1990', birthplace: 'កណ្តាល', address: 'ភ្នំពេញ', tshirt: 'M',
  phone: '012345678', occupation: 'Nurse', highest_degree: 'បរិញ្ញាបត្រ', workplace: 'Test Hospital', department: 'ICU',
  employment: 'បំរើការងាររដ្ឋ', experience: '5',
};
let seq = 0;
async function registerApplicant(base, extra = {}) {
  const c = client(base);
  const email = `applicant${++seq}.${Date.now()}@example.com`;
  const r = await c.post('/api/register', { name_kh: 'សុខ តេស្ត', name_en: 'sok test', email, phone: '012000000', password: 'Applicant-2026!', consent: true, privacy: true, ...extra });
  return { c, r, email };
}
async function adminClient(base) {
  const a = client(base);
  const r = await a.post('/api/login', ADMIN);
  if (r.status !== 200) throw new Error(`admin login failed ${r.status} ${r.text}`);
  if (r.json.user.must_change) {
    ADMIN.password = `${BOOT_PW}x`;
    await a.post('/api/me/password', { password: ADMIN.password });
  }
  return a;
}
// Creates an ACTIVE member with a real password and returns a signed-in client.
async function activeMember(base, a, extra = {}) {
  const email = `member${++seq}.${Date.now()}@example.com`;
  const m = (await a.post('/api/members', { name_kh: 'ចាន់ តេស្ត', name_en: 'CHAN TEST', email, status: 'ACTIVE', consent: 'យល់ព្រម', ...FULL, ...extra })).json;
  const tp = (await a.post(`/api/members/${m.id}/password`)).json;
  const c = client(base);
  await c.post('/api/login', { username: tp.username, password: tp.password });
  await c.post('/api/me/password', { password: 'Member-2026!pw' });
  return { c, m, email, password: 'Member-2026!pw' };
}
async function moderatorClient(base, a) {
  const username = `mod${++seq}`;
  await a.post('/api/users', { username, role: 'moderator', password: 'TempMod-2026!' });
  const c = client(base);
  await c.post('/api/login', { username, password: 'TempMod-2026!' });
  await c.post('/api/me/password', { password: 'Moderator-2026!' });
  return c;
}

// ================================================================ main
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aisarc-test-'));
const dataDir = path.join(tmp, 'data');
let srv;
console.log(`AISARC test suite v${PKG.version} – temporary data in ${tmp}\n`);

try {
  srv = await startServer(dataDir);
  const B = srv.base;
  const db = () => new DatabaseSync(path.join(dataDir, 'aisarc.db'));
  const A = await adminClient(B);

  // ------------------------------------------------------------ platform
  section('Platform & configuration');
  await t('P-01', 'Health check reports the app version', async () => {
    const r = await client(B).get('/healthz');
    eq(r.status, 200, 'status'); eq(r.json.version, PKG.version, 'version');
  });
  await t('P-02', 'Public config exposes only version and public Google settings (no secrets)', async () => {
    const r = await client(B).get('/api/config');
    eq(Object.keys(r.json).sort().join(','), 'googleClientId,googleRedirectUri,version', 'config keys');
  });
  await t('P-03', 'App, privacy notice and self-hosted fonts are served; no Google Fonts', async () => {
    const c = client(B);
    const index = (await c.get('/')).text;
    assert(index.includes('id="app"'), 'index.html');
    assert(!index.includes('fonts.googleapis.com'), 'no Google Fonts request (visitor IPs stay private)');
    assert((await c.get('/privacy.js')).text.includes('PRIVACY_VERSION'), 'privacy.js');
    eq((await c.get('/fonts/fonts.css')).status, 200, 'fonts.css');
  });
  await t('P-04', 'Bootstrap admin from .env is forced to change its password', async () => {
    eq(ADMIN.password, `${BOOT_PW}x`, 'password had to be changed at first sign-in');
  });

  // ------------------------------------------------------------ registration & profile
  section('Registration & profile');
  let app1;
  await t('R-01', 'Registration creates a DRAFT applicant and signs them in', async () => {
    app1 = await registerApplicant(B);
    eq(app1.r.status, 200, 'status');
    const me = (await app1.c.get('/api/me')).json;
    eq(me.member.status, 'DRAFT', 'status'); eq(me.member.member_no, null, 'no membership no. yet');
  });
  await t('R-02', 'Registration requires accepting the declaration', async () => {
    eq((await registerApplicant(B, { consent: false })).r.status, 400, 'status');
  });
  await t('R-03', 'Registration requires accepting the privacy notice', async () => {
    const { r } = await registerApplicant(B, { privacy: false });
    eq(r.status, 400, 'status'); assert(/privacy/i.test(r.json.error), 'privacy error message');
  });
  await t('R-04', 'Consent and privacy acceptance are recorded with time and version', async () => {
    const m = (await app1.c.get('/api/me')).json.member;
    assert(m.consent_at && m.consent_version, 'consent_at / consent_version');
    assert(m.privacy_accepted_at && m.privacy_version, 'privacy_accepted_at / privacy_version');
  });
  await t('R-05', 'Duplicate email is refused with a generic message', async () => {
    const r = await client(B).post('/api/register', { name_kh: 'x', name_en: 'y', email: app1.email, password: 'Applicant-2026!', consent: true, privacy: true });
    eq(r.status, 400, 'status'); assert(!/another member/i.test(r.json.error), 'no detailed enumeration message');
  });
  await t('R-06', 'Invalid input is rejected (short password, bad email, missing name)', async () => {
    eq((await registerApplicant(B, { password: 'short' })).r.status, 400, 'short password');
    eq((await registerApplicant(B, { email: 'not-an-email' })).r.status, 400, 'bad email');
    eq((await registerApplicant(B, { name_kh: '' })).r.status, 400, 'missing name');
  });
  await t('R-07', 'Submitting an incomplete profile is refused and lists missing items', async () => {
    const r = await app1.c.post('/api/me/submit');
    eq(r.status, 400, 'status'); assert(Array.isArray(r.json.missing) && r.json.missing.includes('photo'), 'missing list includes photo');
  });
  await t('R-08', 'Member can edit own profile; Khmer digits are normalised (១២ឆ្នាំ → 12)', async () => {
    const r = await app1.c.put('/api/me', { ...FULL, experience: '១២ឆ្នាំ' });
    eq(r.status, 200, 'status'); eq(r.json.member.experience, '12', 'experience');
  });
  await t('R-09', 'Complete profile + photo can be submitted → REVIEW', async () => {
    eq((await app1.c.post('/api/upload', { field: 'photo', dataUrl: PNG_URL })).status, 200, 'upload');
    const r = await app1.c.post('/api/me/submit');
    eq(r.status, 200, 'status'); eq(r.json.member.status, 'REVIEW', 'status');
  });
  await t('R-10', 'Members cannot change protected fields (status, membership no., dates, login email)', async () => {
    const before = (await app1.c.get('/api/me')).json.member;
    const r = await app1.c.put('/api/me', { status: 'ACTIVE', member_no: 'HACK-1', joined_at: '2000-01-01', expires_at: '2099-01-01', email: 'evil@example.com' });
    eq(r.json.member.status, before.status, 'status'); eq(r.json.member.member_no, before.member_no, 'member_no');
    eq(r.json.member.email, before.email, 'email'); eq(r.json.member.joined_at, before.joined_at, 'joined_at');
  });
  await t('R-11', 'Place of birth and current address accept only one of Cambodia\u2019s 25 provinces', async () => {
    const r = (await app1.c.put('/api/me', { birthplace: 'Mars', address: 'សៀមរាប' })).json.member;
    eq(r.address, 'សៀមរាប', 'province accepted'); eq(r.birthplace, 'កណ្តាល', 'free text ignored');
    const { PROVINCES } = await import('../public/provinces.js');
    eq(PROVINCES.length, 25, '24 provinces + Phnom Penh');
  });

  // ------------------------------------------------------------ workflow
  section('Membership workflow');
  const MOD = await moderatorClient(B, A);
  const app1Id = (await app1.c.get('/api/me')).json.member.id;
  await t('W-01', 'Moderator sees the applicant in the review queue', async () => {
    assert((await MOD.get('/api/members')).json.some((m) => m.id === app1Id && m.status === 'REVIEW'), 'applicant listed');
  });
  await t('W-02', 'Reject needs a reason ("other" needs a message); rejection is stored', async () => {
    eq((await MOD.post(`/api/members/${app1Id}/review`, { decision: 'reject', reason: 'other' })).status, 400, 'other without message');
    eq((await MOD.post(`/api/members/${app1Id}/review`, { decision: 'reject' })).status, 400, 'no reason');
    const r = await MOD.post(`/api/members/${app1Id}/review`, { decision: 'reject', reason: 'missing', message: 'Upload certificate' });
    eq(r.json.status, 'REJECTED', 'status'); eq(r.json.review.reason, 'missing', 'reason stored');
  });
  await t('W-03', 'Rejected member sees the reason and can resubmit', async () => {
    eq((await app1.c.get('/api/me')).json.member.review.message, 'Upload certificate', 'message visible');
    eq((await app1.c.post('/api/me/submit')).json.member.status, 'REVIEW', 'resubmitted');
  });
  await t('W-04', 'Approval assigns membership no., member-since and validity', async () => {
    const r = (await MOD.post(`/api/members/${app1Id}/review`, { decision: 'approve' })).json;
    eq(r.status, 'ACTIVE', 'status'); assert(/^AISARC-\d{4}$/.test(r.member_no), 'member_no'); assert(r.joined_at && r.expires_at, 'dates');
  });
  await t('W-05', 'Moderator cannot review a member who is not waiting for review', async () => {
    eq((await MOD.post(`/api/members/${app1Id}/review`, { decision: 'reject', reason: 'missing' })).status, 400, 'status');
  });
  await t('W-06', 'Expired membership becomes PENDING; renewal request goes to REVIEW', async () => {
    await A.put(`/api/members/${app1Id}`, { expires_at: iso(-1) });
    eq((await app1.c.get('/api/me')).json.member.status, 'PENDING', 'pending');
    eq((await app1.c.post('/api/me/submit')).json.member.status, 'REVIEW', 'renewal requested');
    await A.post(`/api/members/${app1Id}/review`, { decision: 'approve' });
  });
  await t('W-07', '"Not agree" makes the member INACTIVE and records when consent changed', async () => {
    const r = (await app1.c.put('/api/me', { consent: 'មិនយល់ព្រម' })).json.member;
    eq(r.status, 'INACTIVE', 'status'); assert(r.consent_at, 'consent_at updated');
    eq((await app1.c.put('/api/me', { consent: 'យល់ព្រម' })).json.member.status, 'REVIEW', 'agreeing again → review');
    await A.post(`/api/members/${app1Id}/review`, { decision: 'approve' });
  });
  await t('W-08', 'Admin can deactivate and re-activate; validity is kept while still valid', async () => {
    const exp = (await A.get(`/api/members/${app1Id}`)).json.expires_at;
    eq((await A.post(`/api/members/${app1Id}/status`, { status: 'INACTIVE' })).json.status, 'INACTIVE', 'deactivated');
    const r = (await A.post(`/api/members/${app1Id}/status`, { status: 'ACTIVE' })).json;
    eq(r.status, 'ACTIVE', 'activated'); eq(r.expires_at, exp, 'expiry unchanged');
  });

  // ------------------------------------------------------------ admin
  section('Administration');
  await t('A-01', 'Admin can create, edit and search members', async () => {
    const m = (await A.post('/api/members', { name_kh: 'ស្វែងរក', name_en: 'SEARCH ME', email: 'search.me@example.com', ...FULL })).json;
    eq((await A.put(`/api/members/${m.id}`, { department: 'Recovery' })).json.department, 'Recovery', 'edit');
    assert((await A.get('/api/members?q=search%20me')).json.some((x) => x.id === m.id), 'search');
  });
  await t('A-02', 'Excel export: all members and selected members', async () => {
    const all = await A.get('/api/export.xlsx', { raw: true });
    eq(all.status, 200, 'status');
    const rowsAll = XLSX.utils.sheet_to_json(XLSX.read(all.buf).Sheets.Members, { header: 1 });
    const one = await A.get(`/api/export.xlsx?ids=${app1Id}`, { raw: true });
    const rowsOne = XLSX.utils.sheet_to_json(XLSX.read(one.buf).Sheets.Members, { header: 1 });
    assert(rowsAll.length > 2, 'all rows'); eq(rowsOne.length, 2, 'header + 1 selected');
  });
  await t('A-03', 'System users: create a moderator, change role, remove', async () => {
    eq((await A.post('/api/users', { username: 'tmpmod', role: 'moderator', password: 'TempMod-2026!' })).status, 200, 'create');
    const u = (await A.get('/api/users')).json.find((x) => x.username === 'tmpmod');
    eq((await A.put(`/api/users/${u.id}`, { role: 'admin' })).status, 200, 'promote');
    eq((await A.del(`/api/users/${u.id}`)).status, 200, 'remove');
  });
  await t('A-04', 'An admin cannot remove or demote themself (last-admin protection)', async () => {
    const me = (await A.get('/api/me')).json.user;
    eq((await A.del(`/api/users/${me.id}`)).status, 400, 'delete self');
    eq((await A.put(`/api/users/${me.id}`, { role: 'moderator' })).status, 400, 'demote self');
  });
  await t('A-05', 'Delete requires typed confirmation and also removes the login', async () => {
    const { m } = await activeMember(B, A);
    eq((await A.del(`/api/members/${m.id}`, { confirm: 'wrong' })).status, 400, 'wrong confirmation');
    eq((await A.del(`/api/members/${m.id}`, { confirm: m.member_no })).status, 200, 'deleted');
    const d = db(); const n = d.prepare('SELECT COUNT(*) n FROM users WHERE member_id = ?').get(m.id).n; d.close();
    eq(n, 0, 'login removed');
  });
  await t('A-06', 'Association info: admins edit (incl. payment QR), members read', async () => {
    eq((await A.put('/api/association', { fee: '$10 / year', account_no: '000 111 222' })).json.fee, '$10 / year', 'update');
    eq((await app1.c.get('/api/association')).json.account_no, '000 111 222', 'member read');
    eq((await A.post('/api/association/qr', { dataUrl: PNG_URL })).status, 200, 'QR upload');
  });
  await t('A-07', 'Members list is paged on the server (10 by default; 20 / 50) with chip counts and slim rows', async () => {
    for (let i = 0; i < 12; i++) await A.post('/api/members', { name_kh: `ទំព័រ ${i}`, name_en: `PAGER PERSON ${i}`, email: `pager${i}@example.com`, status: 'ACTIVE' });
    const p1 = (await A.get('/api/members?q=pager%20person&s=ALL&page=1&size=10')).json;
    eq(p1.rows.length, 10, 'first page'); eq(p1.total, 12, 'total'); eq(p1.pages, 2, 'pages'); eq(p1.counts.ALL, 12, 'chip count');
    const p2 = (await A.get('/api/members?q=pager%20person&s=ALL&page=2&size=10')).json;
    eq(p2.rows.length, 2, 'second page'); assert(!p2.rows.some((r) => p1.rows.some((x) => x.id === r.id)), 'no overlap');
    eq((await A.get('/api/members?q=pager%20person&page=1&size=20')).json.rows.length, 12, '20 per page');
    eq((await A.get('/api/members?q=pager%20person&page=1&size=9999')).json.size, 10, 'unknown size falls back to 10');
    eq((await A.get('/api/members?q=pager%20person&page=99&size=10')).json.page, 2, 'page clamped');
    assert(!('address' in p1.rows[0]) && !('cnc_reg_no' in p1.rows[0]), 'list rows carry only list fields');
    eq((await MOD.get('/api/members?page=1&size=10&s=REVIEW')).status, 200, 'moderator paging');
  });
  await t('A-08', 'Admin / moderator accounts can have a sign-in email (valid, unique, not on member accounts)', async () => {
    const u = (await A.post('/api/users', { username: 'mod.mail', role: 'moderator', password: 'TempMod-2026!', email: 'Mod.Mail@Example.com' })).json;
    eq(u.email, 'mod.mail@example.com', 'stored in lower case');
    eq((await A.post('/api/users', { username: 'mod.mail2', role: 'moderator', password: 'TempMod-2026!', email: 'mod.mail@example.com' })).status, 400, 'duplicate email');
    eq((await A.post('/api/users', { username: 'mod.mail3', role: 'moderator', password: 'TempMod-2026!', email: 'not-an-email' })).status, 400, 'invalid email');
    const c = client(B);
    const r = await c.post('/api/login', { username: 'MOD.MAIL@example.com', password: 'TempMod-2026!' });
    eq(r.status, 200, 'sign in with the email'); eq(r.json.user.username, 'mod.mail', 'same account'); eq(r.json.user.must_change, true, 'temporary password still has to be changed');
    const d = db(); const memberUser = d.prepare('SELECT id FROM users WHERE member_id IS NOT NULL LIMIT 1').get().id; d.close();
    eq((await A.put(`/api/users/${memberUser}`, { email: 'x@example.com' })).status, 400, 'member accounts use the member email');
    eq((await A.put(`/api/users/${u.id}`, { email: '' })).json.email, null, 'email removed');
    eq((await c.get('/api/me')).status, 401, 'changing the sign-in email ends that account\u2019s sessions');
    eq((await client(B).post('/api/login', { username: 'mod.mail@example.com', password: 'TempMod-2026!' })).status, 401, 'old email no longer works');
  });
  await t('A-09', 'One email, two accounts (member + admin): after signing in the person chooses the account', async () => {
    const mem = await activeMember(B, A);
    const adm = (await A.post('/api/users', { username: 'dual.admin', role: 'admin', password: 'TempAdmin-2026!', email: mem.email })).json;
    eq(adm.shared_with_member, true, 'admin list shows the shared email');
    const s = client(B);
    await s.post('/api/login', { username: 'dual.admin', password: 'TempAdmin-2026!' });
    await s.post('/api/me/password', { password: mem.password });
    const c = client(B);
    const r = await c.post('/api/login', { username: mem.email, password: mem.password });
    eq(r.status, 200, 'status'); assert(!r.json.user && r.json.choose?.length === 2, 'two accounts offered, nobody signed in yet');
    eq((await c.get('/api/me')).status, 401, 'no session before choosing');
    eq((await c.get('/api/login/choices')).json.accounts.map((a) => a.role).sort().join(), 'admin,member', 'choices');
    eq((await c.post('/api/login/choose', { id: 999999 })).status, 400, 'only the offered accounts');
    const ch = (await c.post('/api/login/choose', { id: adm.id })).json;
    eq(ch.user.role, 'admin', 'chosen account'); eq(ch.user.other_accounts, 1, 'knows about the other account');
    eq((await c.get('/api/users')).status, 200, 'signed in as admin');
    eq((await c.post('/api/login/choose', { id: adm.id })).status, 404, 'a choice can be used once');
    eq((await client(B).get('/api/login/choices')).status, 404, 'the list needs the chooser cookie');
    await s.post('/api/me/password', { current: mem.password, password: 'Other-Admin-2026!' });
    const r2 = (await client(B).post('/api/login', { username: mem.email, password: mem.password })).json;
    eq(r2.user?.role, 'member', 'with different passwords, each password opens its own account');
    eq((await client(B).post('/api/login', { username: mem.email, password: 'Other-Admin-2026!' })).json.user?.role, 'admin', 'admin password');
  });

  // ------------------------------------------------------------ events
  section('Events');
  const mem2 = await activeMember(B, A);
  let evUp, evNow, evPast;
  await t('E-01', 'Staff create events; phases are upcoming / happening now / past', async () => {
    evUp = (await MOD.post('/api/events', { title: 'Upcoming', location: 'Calmette Hospital', starts_at: iso(5), seats: 1 })).json.id;
    evNow = (await A.post('/api/events', { title: 'Now', starts_at: iso(0, -1), ends_at: iso(0, 2) })).json.id;
    evPast = (await A.post('/api/events', { title: 'Past', starts_at: iso(-5) })).json.id;
    const list = (await mem2.c.get('/api/events')).json;
    eq(list.find((e) => e.id === evNow).phase, 'ongoing', 'ongoing');
    eq(list.find((e) => e.id === evUp).phase, 'upcoming', 'upcoming');
    eq(list.find((e) => e.id === evPast).phase, 'past', 'past');
  });
  await t('E-02', 'Google Maps: automatic search link; only real Google Maps URLs accepted', async () => {
    assert((await mem2.c.get(`/api/events/${evUp}`)).json.map_link.startsWith('https://www.google.com/maps/search/'), 'search link');
    eq((await A.post('/api/events', { title: 'x', starts_at: iso(3), map_url: 'javascript:alert(1)' })).status, 400, 'javascript: rejected');
    eq((await A.post('/api/events', { title: 'x', starts_at: iso(3), map_url: 'https://evil.example/maps' })).status, 400, 'other host rejected');
    const ok = (await A.post('/api/events', { title: 'x', starts_at: iso(3), map_url: 'https://maps.app.goo.gl/abc123' })).json.id;
    eq((await A.get(`/api/events/${ok}`)).json.map_link, 'https://maps.app.goo.gl/abc123', 'exact link kept');
  });
  await t('E-03', 'ACTIVE member joins; seat limit enforced; seat can be cancelled', async () => {
    eq((await mem2.c.post(`/api/events/${evUp}/join`)).json.joined_count, 1, 'joined');
    const other = await activeMember(B, A);
    eq((await other.c.post(`/api/events/${evUp}/join`)).status, 400, 'full');
    eq((await mem2.c.del(`/api/events/${evUp}/join`)).json.joined_count, 0, 'cancelled');
  });
  await t('E-04', 'Cannot join events that started or ended; non-ACTIVE members cannot join', async () => {
    eq((await mem2.c.post(`/api/events/${evNow}/join`)).status, 400, 'ongoing');
    eq((await mem2.c.post(`/api/events/${evPast}/join`)).status, 400, 'past');
    eq((await (await registerApplicant(B)).c.post(`/api/events/${evUp}/join`)).status, 403, 'draft applicant');
  });
  await t('E-05', 'Privacy: members see only the participant count; staff see names', async () => {
    await mem2.c.post(`/api/events/${evUp}/join`);
    eq((await mem2.c.get(`/api/events/${evUp}`)).json.participants.length, 0, 'member sees no names');
    eq((await MOD.get(`/api/events/${evUp}`)).json.participants.length, 1, 'staff sees list');
  });
  await t('E-06', 'Seat changes validated; members cannot create events', async () => {
    eq((await A.put(`/api/events/${evUp}`, { title: 'Upcoming', starts_at: iso(5), seats: 0 })).status, 200, 'unlimited ok');
    eq((await mem2.c.post('/api/events', { title: 'x', starts_at: iso(3) })).status, 403, 'member create');
  });
  let evPaid;
  await t('E-07', 'Price and "registration closes N days before": closed events refuse new joiners', async () => {
    evPaid = (await A.post('/api/events', { title: 'Paid workshop', starts_at: iso(10), price: '12.50', close_days: 3 })).json.id;
    const e = (await mem2.c.get(`/api/events/${evPaid}`)).json;
    eq(e.price, 12.5, 'price'); eq(e.close_days, 3, 'close_days'); eq(e.registration_open, true, 'open');
    eq(e.registration_closes_at, new Date(new Date(e.starts_at).getTime() - 3 * 864e5).toISOString(), 'closing time');
    const closed = (await A.post('/api/events', { title: 'Closed', starts_at: iso(2), close_days: 3 })).json.id;
    eq((await mem2.c.get(`/api/events/${closed}`)).json.registration_open, false, 'closed');
    const r = await mem2.c.post(`/api/events/${closed}/join`);
    eq(r.status, 400, 'join refused'); assert(/closed/i.test(r.json.error), 'closed message');
    eq((await A.post('/api/events', { title: 'neg', starts_at: iso(5), price: '-5', close_days: -2 })).status, 200, 'negative values clamped');
  });
  let billName;
  await t('E-08', 'Payment proof: joined member uploads a bill; only the member and staff can open it', async () => {
    const outsider = await activeMember(B, A);
    eq((await outsider.c.post(`/api/events/${evPaid}/bill`, { dataUrl: PNG_URL })).status, 403, 'must join first');
    await mem2.c.post(`/api/events/${evPaid}/join`);
    eq((await mem2.c.post(`/api/events/${evPaid}/bill`, { dataUrl: 'data:text/html;base64,PGgxPg==' })).status, 400, 'html refused');
    const e = (await mem2.c.post(`/api/events/${evPaid}/bill`, { dataUrl: PNG_URL })).json;
    assert(e.my_bill && e.my_bill_at, 'bill stored');
    billName = e.my_bill.slice(5);
    assert(new RegExp(`^ev${evPaid}-${mem2.m.id}-bill-`).test(billName), 'file name');
    eq((await mem2.c.get(`/api/files/${billName}`, { raw: true })).status, 200, 'owner can open');
    eq((await outsider.c.get(`/api/files/${billName}`, { raw: true })).status, 403, 'other member refused');
    eq((await MOD.get(`/api/files/${billName}`, { raw: true })).status, 200, 'staff can open');
    const p = (await MOD.get(`/api/events/${evPaid}`)).json.participants.find((x) => x.member_id === mem2.m.id);
    eq(p.gender, FULL.gender, 'gender'); eq(p.workplace, FULL.workplace, 'workplace'); eq(p.bill, e.my_bill, 'bill in list');
    eq((await mem2.c.get(`/api/events/${evPaid}`)).json.participants.length, 0, 'members still see no names');
  });
  await t('E-09', 'Joiner list export to Excel (staff only): name, ID, gender, workplace, training, bill link', async () => {
    eq((await mem2.c.get(`/api/events/${evPaid}/export.xlsx`)).status, 403, 'member refused');
    const r = await MOD.get(`/api/events/${evPaid}/export.xlsx`, { raw: true });
    eq(r.status, 200, 'status');
    const ws = XLSX.read(r.buf).Sheets.Joiners;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const head = rows[0].join('|');
    for (const h of ['Name', 'ID', 'Gender', 'Place of work', 'Technical training', 'Payment proof']) assert(head.includes(h), `column ${h}`);
    eq(rows.length, 2, 'header + 1 joiner');
    assert(rows[1].includes(mem2.m.member_no) && rows[1].includes('View bill'), 'joiner row with bill');
    const link = Object.values(ws).find((c) => c?.l)?.l?.Target || '';
    assert(link.endsWith(`/api/files/${billName}`), 'bill hyperlink needs sign-in (no embedded image)');
    assert((await A.get('/api/audit?q=event.export')).json.length >= 1, 'export audited');
  });
  await t('E-10', 'Cancelling the seat deletes the payment proof file', async () => {
    eq((await mem2.c.del(`/api/events/${evPaid}/join`)).status, 200, 'left');
    const file = path.join(dataDir, 'uploads', billName);
    for (let i = 0; i < 20 && fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 100));
    eq(fs.existsSync(file), false, 'file removed');
  });

  // ------------------------------------------------------------ settings, levels, change requests
  section('Settings, levels & change requests');
  await t('G-01', 'Settings are admin-only and validated', async () => {
    eq((await MOD.get('/api/settings')).status, 403, 'moderator'); eq((await mem2.c.put('/api/settings', {})).status, 403, 'member');
    eq((await A.put('/api/settings', { renewal_date: '02-30' })).status, 400, 'impossible date');
    eq((await A.put('/api/settings', { inactive_years: 0 })).status, 400, 'years range');
    eq((await A.put('/api/settings', { edit_days: 'abc' })).status, 400, 'edit days');
    eq((await A.put('/api/settings', { levels: [{ key: 'member', kh: 'ក', en: 'M', color: 'red;}' }] })).status, 400, 'colour must be #hex');
    eq((await A.put('/api/settings', { levels: [{ key: 'x', kh: 'ក', en: 'X' }] })).status, 400, 'member level required');
    eq((await mem2.c.get('/api/me')).json.settings.edit_days, '30', 'members get public settings');
  });
  await t('G-02', 'Member levels: admin assigns; unknown levels ignored; removed level falls back to member', async () => {
    const { m } = await activeMember(B, A);
    eq((await A.put(`/api/members/${m.id}`, { level: 'leader' })).json.level, 'leader', 'assigned');
    eq((await A.put(`/api/members/${m.id}`, { level: 'emperor' })).json.level, 'leader', 'unknown ignored');
    const levels = (await A.get('/api/settings')).json.levels.filter((l) => l.key !== 'leader');
    eq((await A.put('/api/settings', { levels: [...levels, { kh: 'លេខាធិការ', en: 'Secretary', color: '#0F766E' }] })).status, 200, 'levels saved');
    eq((await A.get(`/api/members/${m.id}`)).json.level, 'member', 'fallback');
    assert((await A.get('/api/settings')).json.levels.some((l) => l.key === 'secretary' && l.color === '#0f766e'), 'new level key + colour');
    eq((await mem2.c.put('/api/me', { level: 'secretary' })).json.member.level, 'member', 'members cannot set their level');
  });
  let lockedMem;
  await t('G-03', 'After the edit window the profile is locked (consent stays editable)', async () => {
    lockedMem = await activeMember(B, A);
    eq((await A.put('/api/settings', { edit_days: '0' })).status, 200, 'set 0 days');
    const me = (await lockedMem.c.get('/api/me')).json.member;
    eq(me.lock.locked, true, 'locked');
    const r = await lockedMem.c.put('/api/me', { address: 'សៀមរាប' });
    eq(r.status, 403, 'edit refused'); eq(r.json.locked, true, 'locked flag');
    eq((await lockedMem.c.post('/api/upload', { field: 'photo', dataUrl: PNG_URL })).status, 403, 'upload refused');
    eq((await lockedMem.c.put('/api/me', { consent: 'យល់ព្រម' })).status, 200, 'consent still editable');
    eq((await (await registerApplicant(B)).c.put('/api/me', { address: 'តាកែវ' })).status, 200, 'applicants never locked');
  });
  await t('G-04', 'Change request per section: admin rejects (reason required) or approves (applied)', async () => {
    eq((await lockedMem.c.post('/api/me/change-requests', { section: 'membership', changes: { level: 'board' } })).status, 400, 'protected section');
    eq((await lockedMem.c.post('/api/me/change-requests', { section: 'contact', changes: {} })).status, 400, 'nothing changed');
    const r1 = (await lockedMem.c.post('/api/me/change-requests', { section: 'personal', changes: { address: 'សៀមរាប', member_no: 'HACK', phone: '011111111' }, note: 'moved' })).json;
    eq(r1.status, 'pending', 'pending'); eq(Object.keys(r1.changes).join(), 'address', 'only section fields kept');
    eq((await lockedMem.c.get('/api/me')).json.member.address, FULL.address, 'not applied yet');
    assert((await A.get('/api/members?s=CHG')).json.some((m) => m.id === lockedMem.m.id), 'CHG filter');
    eq((await MOD.post(`/api/change-requests/${r1.id}/decision`, { decision: 'approve' })).status, 403, 'moderator cannot decide');
    eq((await A.post(`/api/change-requests/${r1.id}/decision`, { decision: 'reject' })).status, 400, 'reason required');
    eq((await A.post(`/api/change-requests/${r1.id}/decision`, { decision: 'reject', reason: 'Please give the full address' })).json.status, 'rejected', 'rejected');
    eq((await lockedMem.c.get('/api/me/change-requests')).json[0].reason, 'Please give the full address', 'member sees reason');
    const r2 = (await lockedMem.c.post('/api/me/change-requests', { section: 'personal', changes: { address: 'តាកែវ' } })).json;
    eq((await A.post(`/api/change-requests/${r2.id}/decision`, { decision: 'approve' })).json.status, 'approved', 'approved');
    eq((await lockedMem.c.get('/api/me')).json.member.address, 'តាកែវ', 'applied');
    const acts = (await A.get(`/api/members/${lockedMem.m.id}/audit`)).json.map((x) => x.action);
    for (const a of ['change.request', 'change.reject', 'change.approve']) assert(acts.includes(a), `audit ${a}`);
    eq((await A.put('/api/settings', { edit_days: '30' })).status, 200, 'reset');
  });
  let lapsed;
  await t('G-05', 'Annual renewal date: memberships older than the last renewal date become PENDING', async () => {
    lapsed = await activeMember(B, A);
    const fresh = await activeMember(B, A);
    const d = db(); d.prepare('UPDATE members SET joined_at = ? WHERE id = ?').run(iso(-4 * 365), lapsed.m.id); d.close();
    eq((await A.put('/api/settings', { renewal_enabled: true, renewal_date: '01-01' })).status, 200, 'enabled');
    const m = (await A.get(`/api/members/${lapsed.m.id}`)).json;
    eq(m.status, 'PENDING', 'lapsed → PENDING'); assert(m.pending_since, 'pending_since');
    eq((await A.get(`/api/members/${fresh.m.id}`)).json.status, 'ACTIVE', 'recent member still ACTIVE');
    eq((await A.get(`/api/members/${fresh.m.id}`)).json.expires_at.slice(5, 10) === '12-31', true, 'valid until the renewal date (Phnom Penh midnight)');
  });
  await t('G-06', 'Auto-INACTIVE after N years PENDING (daily job), with reason, audited', async () => {
    eq((await A.put('/api/settings', { inactive_enabled: true, inactive_years: 1 })).status, 200, 'enabled');
    const port = Number(new URL(srv.base).port);
    await stopServer(srv); srv = await startServer(dataDir, {}, port);
    const m = (await A.get(`/api/members/${lapsed.m.id}`)).json;
    eq(m.status, 'INACTIVE', 'inactive'); eq(m.inactive_reason, 'not_renewed', 'reason');
    assert((await A.get(`/api/members/${lapsed.m.id}/audit`)).json.some((x) => x.action === 'member.auto_inactive'), 'audited');
    eq((await A.put('/api/settings', { renewal_enabled: false, inactive_enabled: false })).status, 200, 'reset');
  });

  // ------------------------------------------------------------ duplicates & filtered export
  section('Duplicates & filtered export');
  let dupA, dupB;
  await t('X-01', 'Possible duplicates are flagged (same phone / email / name) and filterable', async () => {
    dupA = (await A.post('/api/members', { name_kh: 'ស្ទួន មួយ', name_en: 'DUPLICATE ONE', phone: '099 888 777', email: 'dup.one@example.com' })).json;
    dupB = (await A.post('/api/members', { name_kh: 'ស្ទួន ពីរ', name_en: 'SOMEONE ELSE', phone: '+855 99888777', email: 'dup.two@example.com' })).json;
    const a = (await A.get(`/api/members/${dupA.id}`)).json;
    assert(a.dups.some((d) => d.id === dupB.id && d.reasons.includes('same phone')), 'phone match (normalised)');
    const list = (await MOD.get('/api/members?s=DUP')).json.map((m) => m.id);
    assert(list.includes(dupA.id) && list.includes(dupB.id), 'DUP filter');
  });
  await t('X-02', '"Not a duplicate" hides the flag for that pair (admin only)', async () => {
    eq((await MOD.post(`/api/members/${dupA.id}/not-duplicate`)).status, 403, 'moderator refused');
    eq((await A.post(`/api/members/${dupA.id}/not-duplicate`)).json.dups.some((d) => d.id === dupB.id), false, 'cleared');
    eq((await A.get(`/api/members/${dupB.id}`)).json.dups.some((d) => d.id === dupA.id), false, 'cleared both ways');
  });
  await t('X-03', 'Import: a second response with a used email is kept as a flagged REVIEW record without login; re-import skips', async () => {
    const file = path.join(tmp, 'import-dup.xlsx');
    const header = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const row = Array(30).fill(''); row[0] = '11/1/2026 8:00:00'; row[1] = 'dup.one@example.com'; row[3] = 'ស្ទួន មួយ'; row[4] = 'DUPLICATE ONE'; row[29] = 'យល់ព្រម';
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, row]), 'Form');
    fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const run = () => execSync(`"${process.execPath}" scripts/import.js "${file}"`, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, DATA_DIR: dataDir, NODE_NO_WARNINGS: '1' } });
    assert(/1 row\(s\) reuse an email/.test(run()), 'duplicate reported');
    const copies = (await A.get('/api/members?q=duplicate%20one')).json.filter((m) => m.duplicate_email === 'dup.one@example.com');
    eq(copies.length, 1, 'flagged copy created'); eq(copies[0].status, 'REVIEW', 'waits for review'); eq(copies[0].email, null, 'no login email');
    assert(copies[0].dups.some((d) => d.id === dupA.id && d.reasons.includes('same email')), 'linked to original');
    assert(/0 new, 0 updated, 1 skipped/.test(run()), 're-import skipped');
    eq((await A.get('/api/members?q=duplicate%20one')).json.length, 2, 'no extra copy');
  });
  await t('X-04', 'Members export follows the current search and filter', async () => {
    const want = (await A.get('/api/members?s=DUP')).json.length;
    const rows = (u) => A.get(u, { raw: true }).then((r) => XLSX.utils.sheet_to_json(XLSX.read(r.buf).Sheets.Members, { header: 1 }).length - 1);
    eq(await rows('/api/export.xlsx?s=DUP'), want, 'DUP filter');
    eq(await rows('/api/export.xlsx?q=duplicate%20one'), 2, 'search');
    eq(await rows('/api/export.xlsx?s=REVIEW&q=duplicate%20one'), 1, 'search + filter');
    eq((await A.get('/api/export.xlsx?s=ALL&s=DUP')).status, 200, 'repeated parameter handled');
  });

  // ------------------------------------------------------------ privacy
  section('Privacy & data-protection rights');
  await t('D-01', 'Right of access: member downloads all their data as JSON (no password hash)', async () => {
    const r = await mem2.c.get('/api/me/export', { raw: true });
    eq(r.status, 200, 'status'); assert(/attachment/.test(r.headers.get('content-disposition')), 'download');
    const j = JSON.parse(r.text);
    assert(j.member && j.account && Array.isArray(j.events_joined) && Array.isArray(j.activity_on_my_record), 'sections');
    assert(!r.text.includes('password_hash') && !r.text.includes('scrypt'), 'no password hash');
  });
  await t('D-02', 'Right to erasure: request, admin sees it, member can cancel', async () => {
    eq((await mem2.c.post('/api/me/deletion', { reason: 'leaving' })).status, 200, 'request');
    assert((await A.get('/api/privacy/requests')).json.some((x) => x.id === mem2.m.id), 'admin sees request');
    await mem2.c.del('/api/me/deletion');
    assert(!(await A.get('/api/privacy/requests')).json.some((x) => x.id === mem2.m.id), 'cancelled');
  });
  await t('D-03', 'Privacy notice acceptance is recorded (version + time)', async () => {
    const m = (await mem2.c.post('/api/me/privacy', { accept: true })).json.member;
    assert(m.privacy_version && m.privacy_accepted_at, 'recorded');
  });
  await t('D-04', 'Audit log records staff access, changes, exports and decisions', async () => {
    await MOD.get(`/api/members/${mem2.m.id}`);
    const mine = (await A.get(`/api/members/${mem2.m.id}/audit`)).json.map((x) => x.action);
    for (const a of ['member.view', 'deletion.request', 'privacy.accept', 'data.export_own']) assert(mine.includes(a), `missing ${a}`);
    const all = (await A.get('/api/audit?limit=500')).json.map((x) => x.action);
    for (const a of ['members.export', 'member.approve', 'member.reject', 'login', 'register', 'event.create']) assert(all.includes(a), `missing ${a}`);
  });
  await t('D-05', 'Audit log stores field names only, never the personal values', async () => {
    await mem2.c.put('/api/me', { department: 'SECRET-ADDRESS-123' });
    const d = db(); const hit = d.prepare("SELECT COUNT(*) n FROM audit WHERE detail LIKE '%SECRET-ADDRESS-123%'").get().n; d.close();
    eq(hit, 0, 'value not in audit');
  });
  await t('D-06', 'Only admins can read the audit log', async () => {
    eq((await MOD.get('/api/audit')).status, 403, 'moderator'); eq((await mem2.c.get('/api/audit')).status, 403, 'member');
  });
  await t('D-06b', 'Audit log returns only the last hour by default; older entries only when the admin asks', async () => {
    const d = db();
    d.prepare("INSERT INTO audit (at, action, actor) VALUES (?, 'window.test', 'tester')").run(iso(0, -3));
    d.close();
    const has = async (u) => (await A.get(u)).json.some((x) => x.action === 'window.test');
    eq(await has('/api/audit?q=window.test'), false, 'default (1 hour) excludes 3-hour-old entry');
    eq(await has('/api/audit?q=window.test&hours=24'), true, 'last 24 hours includes it');
    eq(await has('/api/audit?q=window.test&hours=0'), true, 'all');
    eq((await A.get('/api/audit?hours=0&limit=5')).json.length <= 5, true, 'limit respected');
    const hist = (await A.get(`/api/members/${mem2.m.id}/audit?limit=2`)).json;
    eq(hist.length, 2, 'record history paged');
    const older = (await A.get(`/api/members/${mem2.m.id}/audit?limit=2&before=${hist[1].id}`)).json;
    assert(older.every((x) => x.id < hist[1].id), 'older page');
  });
  await t('D-07', 'Imported members: consent recorded from the Google Form, no default password', async () => {
    const file = path.join(tmp, 'import.xlsx');
    const header = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const row = Array(30).fill(''); row[0] = '10/3/2026 9:26:06'; row[1] = 'imported.person@example.com'; row[3] = 'នាំចូល'; row[4] = 'IMPORTED PERSON'; row[29] = 'យល់ព្រម';
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, row]), 'Form');
    fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    execSync(`"${process.execPath}" scripts/import.js "${file}"`, { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, NODE_NO_WARNINGS: '1' } });
    const m = (await A.get('/api/members?q=imported.person')).json[0];
    eq(m.consent_version, 'google-form', 'consent version'); assert(m.consent_at, 'consent_at');
    const d = db(); const u = d.prepare('SELECT password_hash FROM users WHERE username = ?').get('imported.person@example.com'); d.close();
    eq(u.password_hash, null, 'no guessable default password');
  });

  // ------------------------------------------------------------ backup
  section('Backup & restore');
  let enc;
  await t('B-01', 'Admin downloads plain and passphrase-encrypted backups', async () => {
    const plain = await A.post('/api/backup', {}, { raw: true });
    eq(plain.status, 200, 'plain'); eq(plain.buf[0], 0x1f, 'gzip');
    enc = await A.post('/api/backup', { passphrase: 'correct horse battery' }, { raw: true });
    eq(enc.buf.subarray(0, 10).toString(), 'AISARCENC1', 'encrypted header');
    eq((await A.post('/api/backup', { passphrase: 'short' })).status, 400, 'short passphrase rejected');
  });
  await t('B-02', 'Restore refuses junk, missing passphrase and wrong passphrase', async () => {
    eq((await A.post('/api/restore', Buffer.from('junk'))).status, 400, 'junk');
    eq((await A.post('/api/restore', enc.buf)).status, 400, 'no passphrase');
    eq((await A.post('/api/restore', enc.buf, { headers: { 'X-Backup-Passphrase': 'wrong-passphrase' } })).status, 400, 'wrong passphrase');
  });
  await t('B-03', 'Encrypted restore works, signs everyone out and keeps the audit log', async () => {
    const before = (await A.get('/api/audit?limit=500')).json.length;
    const r = await A.post('/api/restore', enc.buf, { headers: { 'X-Backup-Passphrase': encodeURIComponent('correct horse battery') } });
    eq(r.status, 200, 'restore'); assert(r.json.counts.members > 0, 'members restored');
    eq((await mem2.c.get('/api/me')).status, 401, 'old sessions revoked');
    const A2 = client(B); await A2.post('/api/login', ADMIN);
    const after = (await A2.get('/api/audit?limit=500')).json;
    assert(after.length >= before && after.some((x) => x.action === 'backup.restore'), 'audit kept + restore logged');
    A.cookie = A2.cookie;
  });
  await t('B-04', 'A backup without any admin account is refused', async () => {
    const doc = { format: 'aisarc-backup', version: 1, tables: { members: [], users: [{ username: 'x', role: 'member' }] }, files: {} };
    eq((await A.post('/api/restore', Buffer.from(JSON.stringify(doc)))).status, 400, 'status');
  });

  // ------------------------------------------------------------ security: access control
  section('Security – access control');
  const mem3 = await activeMember(B, A);
  const mod2 = await moderatorClient(B, A);
  await t('S-01', 'Anonymous requests to every protected API are refused (401)', async () => {
    const anon = client(B);
    const urls = [['GET', '/api/me'], ['GET', '/api/members'], ['GET', '/api/members/1'], ['GET', '/api/users'], ['GET', '/api/audit'],
      ['GET', '/api/events'], ['GET', '/api/association'], ['GET', '/api/export.xlsx'], ['GET', '/api/me/export'], ['GET', '/api/privacy/requests'],
      ['POST', '/api/backup'], ['PUT', '/api/me'], ['POST', '/api/upload'], ['GET', '/api/files/1-photo-0a.png'],
      ['GET', '/api/settings'], ['PUT', '/api/settings'], ['GET', '/api/change-requests'], ['POST', '/api/change-requests/1/decision'],
      ['GET', '/api/me/change-requests'], ['POST', '/api/me/change-requests'], ['POST', '/api/me/request-file'],
      ['GET', '/api/events/1/export.xlsx'], ['POST', '/api/events/1/bill'], ['POST', '/api/members/1/not-duplicate'], ['GET', '/api/files/ev1-1-bill-0a.png']];
    for (const [m, u] of urls) eq((await (m === 'GET' ? anon.get(u) : m === 'PUT' ? anon.put(u, {}) : anon.post(u, {}))).status, 401, `${m} ${u}`);
  });
  await t('S-02', 'Members cannot use staff or admin APIs (403)', async () => {
    for (const u of ['/api/members', '/api/members/1', '/api/users', '/api/audit', '/api/export.xlsx', '/api/privacy/requests']) eq((await mem3.c.get(u)).status, 403, u);
    eq((await mem3.c.post('/api/backup', {})).status, 403, 'backup');
    eq((await mem3.c.put('/api/association', { fee: '0' })).status, 403, 'association');
    eq((await mem3.c.post('/api/members/1/review', { decision: 'approve' })).status, 403, 'review');
    for (const u of ['/api/settings', '/api/change-requests', '/api/events/1/export.xlsx']) eq((await mem3.c.get(u)).status, 403, u);
    eq((await mem3.c.put('/api/settings', { edit_days: '' })).status, 403, 'settings');
    eq((await mem3.c.post('/api/change-requests/1/decision', { decision: 'approve' })).status, 403, 'decide change');
    eq((await mem3.c.post('/api/members/1/not-duplicate')).status, 403, 'not-duplicate');
  });
  await t('S-03', 'Moderators cannot use admin-only APIs (403)', async () => {
    eq((await mod2.put(`/api/members/${mem3.m.id}`, { name_en: 'X' })).status, 403, 'edit member');
    eq((await mod2.del(`/api/members/${mem3.m.id}`, { confirm: 'x' })).status, 403, 'delete');
    eq((await mod2.post(`/api/members/${mem3.m.id}/status`, { status: 'INACTIVE' })).status, 403, 'status');
    eq((await mod2.get('/api/users')).status, 403, 'users'); eq((await mod2.get('/api/export.xlsx')).status, 403, 'export');
    eq((await mod2.post('/api/restore', Buffer.from('x'))).status, 403, 'restore');
    eq((await mod2.put('/api/settings', { edit_days: '' })).status, 403, 'settings');
    eq((await mod2.get('/api/change-requests')).status, 403, 'change requests');
  });
  await t('S-04', 'IDOR: a member cannot open another member’s files', async () => {
    const other = await activeMember(B, A);
    const photo = (await other.c.post('/api/upload', { field: 'photo', dataUrl: PNG_URL })).json.member.photo.slice(5);
    eq((await mem3.c.get(`/api/files/${photo}`)).status, 403, 'other member');
    eq((await other.c.get(`/api/files/${photo}`)).status, 200, 'owner');
    eq((await mod2.get(`/api/files/${photo}`)).status, 200, 'staff');
  });
  await t('S-05', 'Mass assignment and prototype keys are ignored', async () => {
    const r = await mem3.c.put('/api/me', JSON.parse('{"__proto__":{"admin":true},"constructor":"x","toString":"y","role":"admin"}'));
    eq(r.status, 200, 'status');
    assert(!Object.hasOwn(r.json.member, 'constructor') && !Object.hasOwn(r.json.member, 'toString') && !Object.hasOwn(r.json.member, 'admin'), 'keys not stored');
    eq((await mem3.c.get('/api/me')).json.user.role, 'member', 'still a member');
  });

  // ------------------------------------------------------------ security: authentication
  section('Security – authentication & sessions');
  await t('S-10', 'Passwords are stored only as scrypt hashes', async () => {
    const d = db(); const rows = d.prepare('SELECT password_hash FROM users WHERE password_hash IS NOT NULL').all(); d.close();
    assert(rows.length > 0 && rows.every((r) => r.password_hash.startsWith('scrypt2$')), 'hash format');
    assert(!rows.some((r) => r.password_hash.includes('Member-2026!pw')), 'no plain text');
  });
  await t('S-11', 'SQL-injection style input does not bypass login or damage data', async () => {
    eq((await client(B).post('/api/login', { username: "' OR 1=1 --", password: "' OR '1'='1" })).status, 401, 'login');
    eq((await A.get(`/api/members?q=${encodeURIComponent("%' OR 1=1; DROP TABLE members; --")}`)).status, 200, 'search');
    eq((await A.get('/api/members/1%20OR%201=1')).status, 404, 'id param');
    const d = db(); const n = d.prepare('SELECT COUNT(*) n FROM members').get().n; d.close(); assert(n > 0, 'table intact');
  });
  await t('S-12', 'Brute force: account locks after 10 failures even if the attacker changes IP', async () => {
    let last;
    for (let i = 0; i < 11; i++) last = await client(B).post('/api/login', { username: mem3.email, password: `wrong-${i}` });
    eq(last.status, 429, '11th attempt from a new IP');
    assert((await A.get('/api/audit?q=login.failed&limit=50')).json.length >= 10, 'failed sign-ins audited');
  });
  await t('S-13', 'Registration is rate-limited per IP', async () => {
    const c = client(B);
    let last;
    for (let i = 0; i < 6; i++) last = await c.post('/api/register', { name_kh: 'x', name_en: 'y', email: `rl${i}.${Date.now()}@example.com`, password: 'Applicant-2026!', consent: true, privacy: true });
    eq(last.status, 429, '6th registration');
  });
  await t('S-14', 'Session cookie is HttpOnly + SameSite=Lax; tampered cookies are rejected', async () => {
    const c = client(B);
    const r = await c.post('/api/login', ADMIN);
    const sc = r.setCookie.find((x) => x.startsWith('aisarc_session='));
    assert(/HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc), sc);
    const forged = client(B); forged.cookie = c.cookie.slice(0, -2) + (c.cookie.endsWith('AA') ? 'BB' : 'AA');
    eq((await forged.get('/api/me')).status, 401, 'tampered');
  });
  await t('S-15', 'Logout and password change revoke the sessions on every device', async () => {
    const m = await activeMember(B, A);
    const second = client(B); await second.post('/api/login', { username: m.email, password: m.password });
    eq((await second.get('/api/me')).status, 200, 'second device');
    await m.c.post('/api/me/password', { current: m.password, password: 'Changed-2026!pw' });
    eq((await second.get('/api/me')).status, 401, 'revoked after password change');
    const stolen = m.c.cookie; await m.c.post('/api/logout');
    const replay = client(B); replay.cookie = stolen;
    eq((await replay.get('/api/me')).status, 401, 'revoked after logout');
  });
  await t('S-16', 'Temporary passwords: must be changed (server-enforced) and expire after 72 h', async () => {
    const m = (await A.post('/api/members', { name_kh: 'x', name_en: 'TEMP PW', email: `temp${Date.now()}@example.com`, status: 'ACTIVE' })).json;
    const tp = (await A.post(`/api/members/${m.id}/password`)).json;
    eq(tp.expires_hours, 72, 'expiry hours');
    const c = client(B); await c.post('/api/login', { username: tp.username, password: tp.password });
    eq((await c.get('/api/events')).status, 403, 'blocked until changed');
    const tp2 = (await A.post(`/api/members/${m.id}/password`)).json;
    const d = db(); d.prepare('UPDATE users SET temp_expires = ? WHERE member_id = ?').run(iso(-1), m.id); d.close();
    eq((await client(B).post('/api/login', { username: tp2.username, password: tp2.password })).status, 401, 'expired temp password');
  });
  await t('S-17', 'A role change revokes that user’s existing sessions', async () => {
    const m = await activeMember(B, A);
    await A.put(`/api/members/${m.m.id}/role`, { role: 'moderator' });
    eq((await m.c.get('/api/me')).status, 401, 'old session revoked');
  });
  await t('S-18', 'Google sign-in disabled unless configured; callback verifies its CSRF token', async () => {
    eq((await client(B).post('/api/login/google', { credential: 'x' })).status, 400, 'not configured');
    const r = await client(B).post('/auth/google/callback', 'credential=x&g_csrf_token=a', { headers: { Cookie: 'g_csrf_token=b' } });
    eq(r.status, 303, 'redirect'); assert(/error=/.test(r.headers.get('location')), 'error redirect');
  });

  // ------------------------------------------------------------ security: web
  section('Security – web & uploads');
  await t('S-20', 'Security headers: CSP, frame denial, nosniff, referrer, permissions, no-store API', async () => {
    const r = await client(B).get('/');
    const csp = r.headers.get('content-security-policy') || '';
    assert(csp.includes("default-src 'self'") && csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"), 'CSP');
    assert(!/script-src[^;]*'unsafe-inline'/.test(csp), 'no inline scripts allowed');
    eq(r.headers.get('x-frame-options'), 'DENY', 'XFO'); eq(r.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
    eq(r.headers.get('referrer-policy'), 'same-origin', 'referrer'); assert(r.headers.get('permissions-policy'), 'permissions');
    eq(r.headers.get('x-powered-by'), null, 'no x-powered-by');
    eq((await A.get('/api/me')).headers.get('cache-control'), 'no-store', 'API not cached');
  });
  await t('S-21', 'No inline event handlers or inline scripts in the front end (XSS hardening)', async () => {
    const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    assert(!/\son(error|click|load)=["']/.test(appJs), 'inline handlers in app.js');
    assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'inline <script> in index.html');
  });
  await t('S-22', 'Stored XSS payloads are returned as JSON data, never as HTML', async () => {
    const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const r = await mem3.c.put('/api/me', { department: xss });
    eq(r.json.member.department, xss, 'stored verbatim');
    assert(r.headers.get('content-type').startsWith('application/json'), 'JSON content type');
  });
  await t('S-23', 'CSRF: form-encoded or text/plain POSTs to the API are refused (415)', async () => {
    eq((await A.post('/api/members/1/status', 'status=INACTIVE')).status, 415, 'form');
    eq((await A.post('/api/logout', 'x', { headers: { 'Content-Type': 'text/plain' } })).status, 415, 'text/plain');
  });
  await t('S-24', 'Uploads: disguised HTML, SVG, unknown fields and oversized files are rejected', async () => {
    const html = `data:image/png;base64,${Buffer.from('<html><script>alert(1)</script>').toString('base64')}`;
    eq((await mem3.c.post('/api/upload', { field: 'photo', dataUrl: html })).status, 400, 'HTML as PNG');
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;
    eq((await mem3.c.post('/api/upload', { field: 'photo', dataUrl: svg })).status, 400, 'SVG');
    eq((await mem3.c.post('/api/upload', { field: 'constructor', dataUrl: PNG_URL })).status, 400, 'bad field');
    const big = `data:image/png;base64,${Buffer.alloc(13 * 1024 * 1024).toString('base64')}`;
    eq((await mem3.c.post('/api/upload', { field: 'photo', dataUrl: big })).status, 413, 'oversize');
  });
  await t('S-25', 'Served files are sandboxed; path traversal is impossible', async () => {
    const f = (await mem3.c.post('/api/upload', { field: 'photo', dataUrl: PNG_URL })).json.member.photo.slice(5);
    const r = await mem3.c.get(`/api/files/${f}`);
    assert((r.headers.get('content-security-policy') || '').startsWith('sandbox'), 'sandbox CSP');
    eq(r.headers.get('content-type'), 'image/png', 'type');
    for (const p of ['..%2f..%2faisarc.db', '%2e%2e%2f.session-secret', '..%5c..%5caisarc.db']) eq((await A.get(`/api/files/${p}`)).status, 404, p);
  });
  await t('S-26', 'No error details or stack traces are sent to clients', async () => {
    const bad = await client(B).post('/api/login', '{bad json', { headers: { 'Content-Type': 'application/json' } });
    eq(bad.status, 400, 'status'); eq(bad.json.error, 'Bad request', 'generic message');
    const big = await client(B).post('/api/login', { username: 'a'.repeat(100000) });
    eq(big.status, 413, 'big body'); assert(!/at \w+ \(|node_modules/.test(bad.text + big.text), 'no stack');
    eq((await A.get('/api/nope')).json.error, 'Not found', 'unknown API');
  });
  await t('S-27', 'Source code, secrets and the database cannot be downloaded', async () => {
    for (const p of ['/.env', '/server/index.js', '/package.json', '/data/aisarc.db', '/.session-secret', '/.git/config']) {
      const r = await client(B).get(p);
      assert(!/SESSION_SECRET|import express|"dependencies"|SQLite format|\[core\]/.test(r.text), `${p} leaked`);
    }
  });

  // ------------------------------------------------------------ retention (needs a restart)
  section('Data retention');
  await t('T-01', 'Unsubmitted applications older than 12 months are deleted automatically', async () => {
    const { c } = await registerApplicant(B);
    const id = (await c.get('/api/me')).json.member.id;
    const d = db(); d.prepare('UPDATE members SET updated_at = ? WHERE id = ?').run(iso(-400), id); d.close();
    await stopServer(srv); srv = await startServer(dataDir);
    const d2 = db(); const n = d2.prepare('SELECT COUNT(*) n FROM members WHERE id = ?').get(id).n;
    const purge = d2.prepare("SELECT COUNT(*) n FROM audit WHERE action = 'retention.purge'").get().n; d2.close();
    eq(n, 0, 'stale draft deleted'); assert(purge >= 1, 'purge audited');
  });
  await t('T-02', 'Audit entries older than 2 years are purged', async () => {
    const d = db(); d.prepare("INSERT INTO audit (at, action) VALUES (?, 'old.entry')").run(iso(-800)); d.close();
    await stopServer(srv); srv = await startServer(dataDir);
    const d2 = db(); const n = d2.prepare("SELECT COUNT(*) n FROM audit WHERE action = 'old.entry'").get().n; d2.close();
    eq(n, 0, 'old audit entry removed');
  });
  await t('T-03', 'Free-text place of birth / address from older data is mapped to a province (original kept for admins)', async () => {
    const d = db();
    const id = d.prepare('INSERT INTO members (member_no, joined_at, data) VALUES (?,?,?)').run('OLD-0001', iso(-30),
      JSON.stringify({ name_kh: 'ចាស់', name_en: 'OLD TEXT', status: 'ACTIVE', birthplace: 'ភូមិ ក ឃុំ ខ ស្រុកបាទី ខេត្តតាកែវ', address: 'No 12, St 271, Toul Kork, Phnom Penh' })).lastInsertRowid;
    d.close();
    await stopServer(srv); srv = await startServer(dataDir);
    const d2 = db(); const data = JSON.parse(d2.prepare('SELECT data FROM members WHERE id = ?').get(id).data); d2.close();
    eq(data.birthplace, 'តាកែវ', 'birthplace'); eq(data.address, 'ភ្នំពេញ', 'address');
    assert(data.legacy_text?.address?.includes('Toul Kork'), 'original wording kept');
  });
} catch (e) {
  results.push({ cat: current, id: 'FATAL', title: 'Test run aborted', ok: false, ms: 0, err: String(e?.stack || e) });
  console.error(e);
} finally {
  if (srv) await stopServer(srv).catch(() => {});
}

// ------------------------------------------------------------ HTTPS-mode instance
section('Security – HTTPS mode');
try {
  const s = await startServer(path.join(tmp, 'secure'), { PUBLIC_URL: 'https://members.example.org', COOKIE_SECURE: '' });
  await t('H-01', 'With an https PUBLIC_URL the cookie is Secure and HSTS is sent', async () => {
    const r = await client(s.base).post('/api/login', { username: ADMIN.username, password: BOOT_PW });
    const sc = r.setCookie.find((x) => x.startsWith('aisarc_session=')) || '';
    assert(/;\s*Secure/i.test(sc), `Secure flag missing: ${sc}`);
    assert(/max-age=\d+/.test(r.headers.get('strict-transport-security') || ''), 'HSTS header');
  });
  await t('H-02', 'Google redirect URI defaults to PUBLIC_URL/auth/google/callback', async () => {
    eq((await client(s.base).get('/api/config')).json.googleRedirectUri, 'https://members.example.org/auth/google/callback', 'redirect uri');
  });
  await stopServer(s);
} catch (e) {
  results.push({ cat: current, id: 'FATAL-H', title: 'HTTPS-mode run aborted', ok: false, ms: 0, err: String(e) });
}

// ------------------------------------------------------------ supply chain & repository
section('Supply chain & repository');
await t('C-01', 'No known vulnerabilities in production dependencies (npm audit, or OSV database)', async () => {
  let j = {};
  for (let attempt = 0; attempt < 2 && !j.metadata; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 3000));
    let out;
    try { out = execSync('npm audit --omit=dev --json', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 90000 }); }
    catch (e) { out = e.stdout || ''; }
    try { j = JSON.parse(out || '{}'); } catch { j = {}; }
  }
  if (j.metadata) {
    const v = j.metadata.vulnerabilities;
    return eq(v.critical + v.high + v.moderate + v.low, 0, 'npm audit vulnerabilities');
  }
  // Fallback when the npm registry's audit endpoint is unreachable: query the OSV database
  // (includes GitHub security advisories) for every production package in the lockfile.
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const pkgs = Object.entries(lock.packages || {})
    .filter(([p, v]) => p.startsWith('node_modules/') && !v.dev && v.version)
    .map(([p, v]) => ({ name: p.slice(p.lastIndexOf('node_modules/') + 13), version: v.version }));
  let r;
  try {
    r = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ queries: pkgs.map((p) => ({ package: { name: p.name, ecosystem: 'npm' }, version: p.version })) }),
    });
  } catch { r = null; }
  if (!r?.ok) throw Object.assign(new Error('npm registry and OSV not reachable – run `npm audit --omit=dev` manually'), { skip: true });
  const res = (await r.json()).results || [];
  // Some advisories list every version as affected because the fix is not on the npm registry
  // (e.g. SheetJS `xlsx`, fixed builds ship from cdn.sheetjs.com). OSV records the real bound in
  // `last_known_affected_version_range` ("< 0.20.2"); a version at/above that bound is not affected.
  const semver = (v) => String(v).split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const gte = (a, b) => { const x = semver(a); const y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return true; };
  const vulnerable = [];
  for (const [i, p] of pkgs.entries()) {
    for (const { id } of res[i]?.vulns || []) {
      const v = await (await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(30000) })).json();
      const bounds = (v.affected || []).filter((a) => a.package?.name === p.name)
        .map((a) => /^<\s*([\d.]+)$/.exec(a.database_specific?.last_known_affected_version_range || '')?.[1]);
      if (bounds.length && bounds.every((b) => b && gte(p.version, b))) continue;
      vulnerable.push(`${p.name}@${p.version} (${id})`);
    }
  }
  eq(vulnerable.length, 0, `vulnerable packages (OSV, ${pkgs.length} checked): ${vulnerable.join(', ')}`);
});
await t('C-02', 'Secrets and personal data are excluded from git and the Docker image', async () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  const di = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
  for (const p of ['.env', 'data/', '*.xlsx', '*.json.gz', '*.db']) assert(gi.includes(p), `.gitignore missing ${p}`);
  for (const p of ['.env', 'data', '*.xlsx']) assert(di.includes(p), `.dockerignore missing ${p}`);
});
await t('C-03', 'No secrets, spreadsheets, databases or keys are tracked in git', async () => {
  const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  const bad = files.filter((f) => /(^|\/)\.env$|\.xlsx$|\.db$|\.json\.gz$|session-secret|id_ed25519$|id_rsa$/.test(f));
  eq(bad.length, 0, `tracked sensitive files: ${bad.join(', ')}`);
});
await t('C-04', 'Docker: non-root, read-only filesystem, no capabilities; app never gets GIT_TOKEN', async () => {
  const df = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
  const dc = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
  assert(/^USER node/m.test(df), 'USER node'); assert(/read_only: true/.test(dc), 'read_only');
  assert(/cap_drop: \[ALL\]/.test(dc), 'cap_drop'); assert(/no-new-privileges:true/.test(dc), 'no-new-privileges');
  assert(/GIT_TOKEN: ""/.test(dc), 'app does not receive GIT_TOKEN');
});
await t('C-05', 'No emoji or symbol characters in the interface or documentation (SVG icons only)', async () => {
  // Emoji, dingbats (check marks, crosses, pencils, stars), misc symbols, geometric shapes, emoji variation selector.
  const EMOJI = /[\u2300-\u23FF\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F]/u;
  // The UI must not use arrows as icons either (documentation prose may write "Profile → Data").
  const ARROWS = /[\u2190-\u21FF]/u;
  const ui = fs.readdirSync(path.join(ROOT, 'public')).filter((f) => /\.(js|css|html|json)$/.test(f)).map((f) => `public/${f}`);
  const docs = ['README.md', 'PRIVACY.md', 'docs/DATA-PROTECTION.md', 'test/run.js'];
  const bad = [];
  for (const f of [...ui, ...docs]) {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((l, i) => {
      if (EMOJI.test(l) || (f.startsWith('public/') && ARROWS.test(l))) bad.push(`${f}:${i + 1}`);
    });
  }
  eq(bad.length, 0, `emoji/symbols found: ${bad.slice(0, 10).join(', ')}`);
});

fs.rmSync(tmp, { recursive: true, force: true });

// ================================================================ report
const passed = results.filter((r) => r.ok === true).length;
const failed = results.filter((r) => r.ok === false).length;
const skipped = results.filter((r) => r.ok === null).length;
const cats = [...new Set(results.map((r) => r.cat))];
let commit = 'n/a';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no git */ }
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  '# AISARC Membership – Test Report', '',
  '> Generated automatically by `npm test` (`test/run.js`). Don’t edit by hand – run the tests again to refresh it.', '',
  '| | |', '| --- | --- |',
  `| Application version | **${PKG.version}** (commit \`${commit}\`) |`,
  `| Date | ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC |`,
  `| Environment | Node.js ${process.version} on ${os.platform()} ${os.arch()} – temporary test database, real HTTP server |`,
  `| Result | **${failed ? 'FAILED' : 'PASSED'} – ${passed} passed, ${failed} failed${skipped ? `, ${skipped} not run` : ''}** (${results.length} checks) |`, '',
  '## Summary by area', '', '| Area | Passed | Failed | Not run |', '| --- | :---: | :---: | :---: |',
  ...cats.map((c) => { const rs = results.filter((r) => r.cat === c); return `| ${c} | ${rs.filter((r) => r.ok === true).length} | ${rs.filter((r) => r.ok === false).length} | ${rs.filter((r) => r.ok === null).length} |`; }),
  '', '## Detailed results', '',
];
for (const c of cats) {
  md.push(`### ${c}`, '', '| ID | Check | Result | Time |', '| --- | --- | --- | ---: |');
  for (const r of results.filter((x) => x.cat === c)) md.push(`| ${r.id} | ${esc(r.title)}${r.err ? `<br><sub>${esc(r.err)}</sub>` : ''} | ${r.ok === true ? 'Pass' : r.ok === null ? 'Not run' : '**Fail**'} | ${r.ms} ms |`);
  md.push('');
}
md.push('## Compliance mapping', '',
  'How the automated checks map to personal-data protection principles (details in [DATA-PROTECTION.md](DATA-PROTECTION.md)).', '',
  '| Principle | Control in the system | Verified by |', '| --- | --- | --- |',
  '| Lawfulness & consent | Declaration and privacy notice must be accepted; time and version recorded; consent can be withdrawn | R-02, R-03, R-04, W-07, D-03, D-07 |',
  '| Transparency | Bilingual, versioned privacy notice readable without an account; members asked again when it changes | P-03, D-03 |',
  '| Purpose limitation & data minimisation | Members see only their own data; event lists show counts only; joiner details, bills and exports staff-only; settings and backups admin-only; no third-party fonts | P-03, E-05, E-08, E-09, S-02, S-03, G-01 |',
  '| Accuracy | Members correct their own data; after the edit window via change requests reviewed by an admin; duplicate records are flagged | R-08, A-01, G-03, G-04, X-01 … X-03 |',
  '| Storage limitation | Unsubmitted applications deleted after 12 months; audit log 2 years; server safety backups 90 days; payment proofs deleted with the seat or event | T-01, T-02, E-10 |',
  '| Integrity & confidentiality | Hashed passwords, role-based access, session revocation, rate limits, CSP, upload checks, encrypted backups, owner/staff-only bill files | S-01 … S-27, B-01 … B-04, H-01, E-08 |',
  '| Accountability | Audit log of access, changes, exports, backups, deletions, change-request decisions and automatic status changes (field names only) | D-04, D-05, D-06, B-03, E-09, G-04, G-06 |',
  '| Data-subject rights | Download own data, correct (directly or by change request), withdraw consent at any time (also when locked), request deletion | D-01, D-02, R-08, W-07, G-03, G-04 |',
  '', '## Verified manually in a browser', '',
  'Checked in Microsoft Edge (headless, phone and desktop sizes) during development:', '',
  '- All pages render under the strict Content-Security-Policy with **no CSP violations**; the self-hosted Khmer font loads.',
  '- Stored XSS payloads (`<img onerror>`, `<script>`, `<svg onload>`) in event and member fields are shown as text and **never execute**.',
  '- Registration → profile completion → submit, the system tour and the **?** button work on a phone-sized screen.',
  '- Event sections (happening now / upcoming / past) and the Google Maps button.',
  '- v1.8: logo-blue and level-coloured cards, locked profile with per-section change requests, admin settings and levels editor,',
  '  duplicate flags and filter, event price / registration deadline / payment-proof upload, joiner list and Excel export.',
  '', '## How to run', '', '```bash', 'npm install', 'npm test        # writes docs/TEST-REPORT.md; exits non-zero if anything fails', '```', '');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, md.join('\n'));
console.log(`\n${passed} passed, ${failed} failed, ${skipped} not run → ${path.relative(ROOT, REPORT)}`);
process.exit(failed ? 1 : 0);
