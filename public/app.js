import { FIELDS, SECTIONS, canEdit } from '/fields.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const tabbar = $('#tabbar');
const state = { user: null, member: null, config: null };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON = {
  logout: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12l-4.4-4.4Z"/></svg>',
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3 2.2 3.5 5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>',
};

// ---------- helpers ----------
async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.user && !url.startsWith('/api/login')) { state.user = null; go('/login'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 2800);
}

const go = (path) => { if (location.hash !== `#${path}`) location.hash = path; else route(); };

const TZ = 'Asia/Phnom_Penh';
const fmtDate = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, ...opts }) : '—';
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }) : '—');
// ISO -> "YYYY-MM-DDTHH:mm" in Cambodia time for <input type=datetime-local>, and back.
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : '');
const fromLocalInput = (v) => (v ? new Date(`${v}:00+07:00`).toISOString() : '');

function fileUrl(v) {
  if (!v) return '';
  if (v.startsWith('file:')) return `/api/files/${encodeURIComponent(v.slice(5))}`;
  const drive = v.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/) || v.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w600`;
  return /^https?:\/\//.test(v) ? v : '';
}
const fileLink = (v) => (v?.startsWith('file:') ? fileUrl(v) : v);

const initials = (m) => (m?.name_en || m?.name_kh || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function photoHtml(m, cls = '') {
  const url = fileUrl(m?.photo);
  const ini = esc(initials(m));
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-i="${ini}" onerror="this.parentNode.textContent=this.dataset.i">`
    : ini;
}

// Resize images client side to keep uploads small and fast on mobile networks.
function readFile(file, maxPx = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (!file.type.startsWith('image/')) return resolve(reader.result);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setTabs(active) {
  const u = state.user;
  if (!u) { tabbar.hidden = true; return; }
  const tabs = [];
  if (u.member_id) tabs.push(['/pass', 'Pass', ICON.pass], ['/profile', 'Profile', ICON.user]);
  if (u.role === 'admin') tabs.push(['/admin', 'Members', ICON.users]);
  tabs.push(['/password', 'Password', ICON.key]);
  tabbar.innerHTML = tabs.map(([href, label, icon]) =>
    `<a href="#${href}" class="${active === href ? 'on' : ''}">${icon}<span>${label}</span></a>`).join('');
  tabbar.hidden = false;
}

const header = (title, sub = '', back = '') => `
  <header class="top">
    ${back ? `<a class="icon-btn" href="#${back}" aria-label="Back">${ICON.back}</a>` : ''}
    <div style="flex:1;min-width:0"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <button class="icon-btn" data-logout aria-label="Sign out" title="Sign out">${ICON.logout}</button>
  </header>`;

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-logout]')) return;
  await api('/api/logout', { body: {} }).catch(() => {});
  state.user = state.member = null;
  go('/login');
});

// ---------- pass card ----------
function passCard(m) {
  const status = m.status || 'ACTIVE';
  return `
  <section class="pass" aria-label="Membership pass">
    <div class="pass-head">
      <img class="pass-logo" src="/img/logo.png" alt="AISARC logo">
      <div class="pass-status"><div class="pass-label">Status</div><div class="pass-val ${esc(status)}">${esc(status)}</div></div>
    </div>
    <div class="pass-body">
      <div class="pass-info">
        <div><div class="pass-label">Name</div><div class="pass-val">${esc(m.name_en || '—')}</div><div class="kh">${esc(m.name_kh || '')}</div></div>
        <div><div class="pass-label">Birthday</div><div class="pass-val">${esc(m.dob || '—')}</div></div>
        <div><div class="pass-label">Membership No.</div><div class="pass-val">${esc(m.member_no || '—')}</div></div>
        <div><div class="pass-label">Member since</div><div class="pass-val">${esc(fmtDate(m.joined_at))}</div></div>
      </div>
      <div class="pass-photo">${photoHtml(m)}</div>
    </div>
    <div class="pass-foot"><img src="/img/name.png" alt="ស.គ.ឯ.ស.ប.ក AISARC"></div>
  </section>`;
}

function viewPass() {
  const m = state.member;
  const today = new Date().toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
  app.className = '';
  app.innerHTML = `${header('Your Pass', esc(today))}
    ${passCard(m)}
    <div class="meta-row"><span>Phone <b>${esc(m.phone || '—')}</b></span><span>T-shirt <b>${esc(m.tshirt || '—')}</b></span></div>
    <div class="card" style="margin-top:16px">
      <h2>${esc(m.name_kh || m.name_en)}</h2>
      <div class="sub" style="color:var(--muted);font-size:14px">${esc(m.workplace || '')}${m.department ? ` · ${esc(m.department)}` : ''}</div>
      <div class="actions" style="margin-top:14px"><a class="btn block" href="#/profile">${ICON.user} Edit my information</a></div>
    </div>`;
}

// ---------- member form ----------
function fieldHtml(f, m, role) {
  const editable = canEdit(f, role);
  const v = m[f.key] ?? '';
  const dis = editable ? '' : 'disabled';
  const lbl = `<span class="lbl">${esc(f.kh)}${f.required ? ' *' : ''}${editable ? '' : ' <span class="lock">🔒</span>'}<small>${esc(f.en)}</small></span>`;
  const name = `name="${f.key}" id="f_${f.key}"`;
  let input;
  if (f.type === 'photo' || f.type === 'file') {
    const url = fileUrl(v);
    const thumb = f.type === 'photo'
      ? (url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : 'No photo')
      : (v ? '📄' : 'None');
    input = `<div class="upload"><div class="thumb">${thumb}</div><div class="actions">
      ${editable ? `<label class="btn sm light">Upload<input type="file" data-upload="${f.key}" accept="${f.accept || 'image/*'}"></label>` : ''}
      ${v ? `<a class="btn sm light" href="${esc(fileLink(v))}" target="_blank" rel="noopener">View</a>` : ''}</div></div>`;
    return `<div class="field">${lbl}${input}</div>`;
  }
  if (f.type === 'datetime') {
    input = editable ? `<input type="datetime-local" ${name} value="${esc(toLocalInput(v))}">` : `<input value="${esc(fmtDateTime(v))}" disabled>`;
  } else if (f.type === 'select') {
    const opts = [...f.options];
    if (v && !opts.includes(v)) opts.unshift(v);
    input = `<select ${name} ${dis}><option value="">—</option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea ${name} ${dis} rows="2">${esc(v)}</textarea>`;
  } else {
    const type = f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text';
    const list = f.list ? `list="dl_${f.key}"` : '';
    input = `<input type="${type}" ${name} ${list} value="${esc(v)}" ${dis} ${f.placeholder ? `placeholder="${f.placeholder}"` : ''} ${f.required ? 'required' : ''} ${f.upper ? 'style="text-transform:uppercase"' : ''}>`;
    if (f.list) input += `<datalist id="dl_${f.key}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<label class="field" for="f_${f.key}">${lbl}${input}</label>`;
}

function formHtml(m, role) {
  return SECTIONS.map((s) => {
    const fs = FIELDS.filter((f) => f.section === s.id);
    return `<section class="card"><h2>${esc(s.kh)} <small>${esc(s.en)}</small></h2>
      <div class="grid2">${fs.map((f) => fieldHtml(f, m, role)).join('')}</div></section>`;
  }).join('');
}

function collect(form, role) {
  const out = {};
  for (const f of FIELDS) {
    const el = form.elements[f.key];
    if (!el || !canEdit(f, role)) continue;
    out[f.key] = f.type === 'datetime' ? fromLocalInput(el.value) : el.value.trim();
  }
  return out;
}

function bindUploads(root, memberId, onDone) {
  root.querySelectorAll('[data-upload]').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      toast('Uploading…');
      const dataUrl = await readFile(file);
      const r = await api('/api/upload', { body: { field: inp.dataset.upload, dataUrl, memberId } });
      toast('Uploaded ✓');
      onDone(r.member);
    } catch (e) { toast(e.message, true); }
  }));
}

function viewProfile() {
  const m = state.member;
  app.className = '';
  app.innerHTML = `${header('My Profile', 'ព័ត៌មានផ្ទាល់ខ្លួន · Edit your information')}
    <form id="pf" novalidate>${formHtml(m, 'member')}
      <div class="sticky-save"><button class="btn block" type="submit">Save changes · រក្សាទុក</button></div>
    </form>`;
  const form = $('#pf');
  bindUploads(form, null, (mm) => { state.member = mm; viewProfile(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api('/api/me', { method: 'PUT', body: collect(form, 'member') });
      state.member = r.member;
      toast('Saved ✓');
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });
}

// ---------- password ----------
function viewPassword() {
  const must = state.user.must_change;
  app.className = '';
  app.innerHTML = `${header('Password', 'ពាក្យសម្ងាត់')}
    <form class="card" id="pw">
      ${must ? '<p style="margin-top:0;color:#b45309">Please set a new password before continuing.<br>សូមកំណត់ពាក្យសម្ងាត់ថ្មី។</p>' : ''}
      <div class="field"><span class="lbl">Username</span><input value="${esc(state.user.username)}" disabled></div>
      ${must ? '' : '<label class="field"><span class="lbl">Current password<small>Leave empty if you only use Google sign-in</small></span><input type="password" name="current" autocomplete="current-password"></label>'}
      <label class="field"><span class="lbl">New password<small>At least 8 characters</small></span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
      <label class="field"><span class="lbl">Confirm new password</span><input type="password" name="confirm" required autocomplete="new-password"></label>
      <button class="btn block" type="submit">Update password</button>
    </form>`;
  $('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (f.password.value !== f.confirm.value) return toast('Passwords do not match', true);
    try {
      await api('/api/me/password', { body: { current: f.current?.value || '', password: f.password.value } });
      state.user.must_change = false;
      toast('Password updated ✓');
      go(home());
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- admin ----------
let searchTimer;
async function viewAdmin() {
  app.className = 'wide';
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
  app.innerHTML = `${header('Members', 'សមាជិក · Admin')}
    <div class="search">${ICON.search}<input id="q" type="search" placeholder="Search name, phone, email, workplace, no…" value="${esc(q)}" autocomplete="off"></div>
    <div class="toolbar">
      <span class="count" id="count"></span>
      <a class="btn sm" href="#/admin/new">+ Add</a>
      <label class="btn sm light" title="Import members from the Google Form XLSX">Import<input type="file" id="imp" accept=".xlsx,.xls" hidden></label>
      <a class="btn sm light" href="/api/export.csv" title="Download all members as CSV (Excel)">Export</a>
    </div>
    <div class="list" id="list"><div class="spin"></div></div>`;
  const load = async (term) => {
    try {
      const rows = await api(`/api/members?q=${encodeURIComponent(term)}`);
      $('#count').textContent = `${rows.length} member${rows.length === 1 ? '' : 's'}`;
      $('#list').innerHTML = rows.length ? rows.map((m) => `
        <a class="mrow" href="#/admin/m/${m.id}">
          <div class="avatar">${photoHtml(m)}</div>
          <div class="info"><div class="n1">${esc(m.name_kh)} · ${esc(m.name_en)}</div>
            <div class="n2">${esc(m.member_no)} · ${esc(m.phone || '')}</div>
            <div class="n2">${esc(m.workplace || '')}</div></div>
          <span class="chip ${esc(m.status)}">${esc(m.status || 'ACTIVE')}</span>
        </a>`).join('') : '<div class="empty">No members found</div>';
    } catch (e) { toast(e.message, true); }
  };
  load(q);
  $('#q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      history.replaceState(null, '', `#/admin${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ''}`);
      load(e.target.value);
    }, 200);
  });
  $('#imp').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const overwrite = confirm('Overwrite existing members with data from this file?\n\nOK = overwrite, Cancel = only add new members');
    try {
      const r = await api('/api/import', { body: { dataUrl: await readFile(file), overwrite } });
      toast(`Imported ${r.inserted} new, ${r.updated} updated, ${r.skipped} skipped`);
      load($('#q').value);
    } catch (err) { toast(err.message, true); }
  });
}

async function viewAdminEdit(id) {
  app.className = 'wide';
  const isNew = id === 'new';
  let m = { status: 'ACTIVE' };
  if (!isNew) {
    app.innerHTML = '<div class="spin"></div>';
    try { m = await api(`/api/members/${id}`); } catch (e) { toast(e.message, true); return go('/admin'); }
  }
  const back = sessionStorage.getItem('adminList') || '/admin';
  app.innerHTML = `${header(isNew ? 'New member' : esc(m.name_en || 'Member'), isNew ? 'Add a member' : `${esc(m.member_no)} · Login: ${esc(m.username || m.email || '—')}`, back)}
    <div class="admin-edit">
      <div class="side">
        ${isNew ? '' : passCard(m)}
        ${isNew ? '' : `<div class="actions" style="margin-top:14px">
          <button class="btn light sm" id="reset">${ICON.key} Reset password</button>
          <button class="btn danger sm" id="del">Delete</button></div>`}
      </div>
      <form id="af" novalidate>${formHtml(m, 'admin')}
        <div class="sticky-save"><button class="btn block" type="submit">${isNew ? 'Create member' : 'Save changes'}</button></div>
      </form>
    </div>`;
  if (isNew) app.querySelectorAll('[data-upload]').forEach((el) => el.closest('label').replaceWith('Save first, then upload'));
  const form = $('#af');
  bindUploads(form, m.id, () => viewAdminEdit(id));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api(isNew ? '/api/members' : `/api/members/${id}`, { method: isNew ? 'POST' : 'PUT', body: collect(form, 'admin') });
      toast('Saved ✓');
      isNew ? go(`/admin/m/${r.id}`) : viewAdminEdit(id);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  $('#reset')?.addEventListener('click', async () => {
    if (!confirm('Generate a new temporary password for this member?')) return;
    try {
      const r = await api(`/api/members/${id}/password`, { body: {} });
      const d = document.createElement('dialog');
      d.innerHTML = `<h3 style="margin-top:0">Temporary password</h3><p>Share with the member. They must change it after signing in.</p>
        <div class="field"><span class="lbl">Username</span><div class="mono">${esc(r.username)}</div></div>
        <div class="field"><span class="lbl">Password</span><div class="mono">${esc(r.password)}</div></div>
        <button class="btn block" onclick="this.closest('dialog').close()">Done</button>`;
      document.body.append(d);
      d.addEventListener('close', () => d.remove());
      d.showModal();
    } catch (err) { toast(err.message, true); }
  });
  $('#del')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${m.name_en || 'this member'}? This cannot be undone.`)) return;
    try { await api(`/api/members/${id}`, { method: 'DELETE', body: {} }); toast('Deleted'); go('/admin'); } catch (err) { toast(err.message, true); }
  });
}

// ---------- login ----------
function viewLogin() {
  tabbar.hidden = true;
  app.className = '';
  app.innerHTML = `<div class="login">
    <div class="brand"><img src="/img/logo.png" alt="AISARC logo"><img class="name" src="/img/name.png" alt="ស.គ.ឯ.ស.ប.ក AISARC">
      <p>ប្រព័ន្ធគ្រប់គ្រងសមាជិក · Membership Portal</p></div>
    <form class="card" id="lf">
      <label class="field"><span class="lbl">Username / Email<small>ឈ្មោះអ្នកប្រើ ឬ អ៊ីម៉ែល</small></span><input name="username" autocomplete="username" required autocapitalize="none"></label>
      <label class="field"><span class="lbl">Password<small>ពាក្យសម្ងាត់</small></span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn block" type="submit">Sign in · ចូល</button>
      <p class="err" id="lerr"></p>
      <div id="gwrap" hidden><div class="divider">or</div><div id="gbtn"></div></div>
      <p class="hint">First time? Your password is your phone number. Forgot it? Contact the AISARC admin.</p>
    </form></div>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      const r = await api('/api/login', { body: { username: f.username.value.trim(), password: f.password.value } });
      await afterLogin(r.user);
    } catch (err) { $('#lerr').textContent = err.message; }
  });
  initGoogle();
}

function initGoogle() {
  const cid = state.config?.googleClientId;
  if (!cid) return;
  const render = () => {
    google.accounts.id.initialize({
      client_id: cid,
      callback: async ({ credential }) => {
        try {
          const r = await api('/api/login/google', { body: { credential } });
          await afterLogin(r.user);
        } catch (err) { $('#lerr').textContent = err.message; }
      },
    });
    $('#gwrap').hidden = false;
    google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
  };
  if (window.google?.accounts) return render();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = render;
  document.head.append(s);
}

async function afterLogin(user) {
  state.user = user;
  const me = await api('/api/me');
  state.member = me.member;
  go(user.must_change ? '/password' : home());
}

const home = () => (state.user?.member_id ? '/pass' : '/admin');

// ---------- router ----------
async function route() {
  const path = location.hash.slice(1).split('?')[0] || '/';
  if (!state.config) state.config = await api('/api/config').catch(() => ({}));
  if (!state.user && !state.checked) {
    state.checked = true;
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.member = me.member;
    } catch { /* not signed in */ }
  }
  if (!state.user) return path === '/login' ? viewLogin() : go('/login');
  if (path === '/login' || path === '/') return go(home());
  if (state.user.must_change && path !== '/password') return go('/password');

  const admin = state.user.role === 'admin';
  window.scrollTo(0, 0);
  if (path === '/pass' && state.member) { setTabs('/pass'); return viewPass(); }
  if (path === '/profile' && state.member) { setTabs('/profile'); return viewProfile(); }
  if (path === '/password') { setTabs('/password'); return viewPassword(); }
  if (path === '/admin' && admin) { sessionStorage.setItem('adminList', location.hash.slice(1)); setTabs('/admin'); return viewAdmin(); }
  const mm = path.match(/^\/admin\/(?:m\/(\d+)|(new))$/);
  if (mm && admin) { setTabs('/admin'); return viewAdminEdit(mm[1] || mm[2]); }
  go(home());
}

window.addEventListener('hashchange', route);
route();
