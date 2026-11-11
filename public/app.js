import {
  FIELDS, SECTIONS, STATUSES, STATUS_MAP, ROLES, REJECT_REASONS, ASSOC_FIELDS, DECLARATION, CONSENT_YES, canEdit,
} from '/fields.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const tabbar = $('#tabbar');
const state = { user: null, member: null, config: null, checked: false };
const IMG = (n) => `/img/${n}?v=2`; // bump to bust cached images

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON = {
  logout: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12l-4.4-4.4Z"/></svg>',
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3 2.2 3.5 5"/></svg>',
  org: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V10M19 21V10M9 21v-6h6v6M2 10l10-6 10 6"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  seat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M17 8h4M19 6v4"/></svg>',
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

// Live clock on active passes (proves the pass is not a screenshot).
function tickClocks() {
  const now = new Date();
  const d = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const t = now.toLocaleTimeString('en-GB', { hour12: false });
  document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = `${d} · ${t}`));
}
setInterval(tickClocks, 1000);

function fileUrl(v) {
  if (!v) return '';
  if (v.startsWith('file:')) return `/api/files/${encodeURIComponent(v.slice(5))}`;
  const drive = v.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/) || v.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w600`;
  return /^https?:\/\//.test(v) ? v : '';
}
const fileLink = (v) => (v?.startsWith('file:') ? fileUrl(v) : v);

const initials = (m) => (m?.name_en || m?.name_kh || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function photoHtml(m) {
  const url = fileUrl(m?.photo);
  const ini = esc(initials(m));
  return url
    ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-i="${ini}" onerror="this.parentNode.textContent=this.dataset.i">`
    : ini;
}

const statusOf = (m) => STATUS_MAP[m?.status] || STATUS_MAP.ACTIVE;
const chip = (m) => { const s = statusOf(m); return `<span class="chip c-${s.color}">${esc(s.key)}</span>`; };

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

const isStaff = () => ['admin', 'moderator'].includes(state.user?.role);
const isAdmin = () => state.user?.role === 'admin';

function setTabs(active) {
  const u = state.user;
  if (!u) { tabbar.hidden = true; return; }
  const tabs = [];
  if (u.member_id) tabs.push(['/pass', 'Pass', ICON.pass], ['/profile', 'Profile', ICON.user]);
  tabs.push(['/events', 'Events', ICON.cal], ['/association', 'Association', ICON.org]);
  if (isStaff()) tabs.push(['/admin', isAdmin() ? 'Members' : 'Review', ICON.users]);
  if (isAdmin()) tabs.push(['/system', 'Admin', ICON.shield]);
  tabbar.innerHTML = tabs.map(([href, label, icon]) =>
    `<a href="#${href}" class="${active === href ? 'on' : ''}">${icon}<span>${label}</span></a>`).join('');
  tabbar.hidden = false;
}

const header = (title, sub = '', back = '') => `
  <header class="top">
    ${back ? `<a class="icon-btn" href="#${back}" aria-label="Back">${ICON.back}</a>` : ''}
    <div style="flex:1;min-width:0"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <a class="icon-btn" href="#/password" aria-label="Change password" title="Change password">${ICON.key}</a>
    <button class="icon-btn" data-logout aria-label="Sign out" title="Sign out">${ICON.logout}</button>
  </header>`;

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-logout]')) return;
  await api('/api/logout', { body: {} }).catch(() => {});
  state.user = state.member = null;
  go('/login');
});

function modal(html) {
  const d = document.createElement('dialog');
  d.innerHTML = html;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

// ---------- pass card ----------
function passCard(m) {
  const s = statusOf(m);
  const active = s.key === 'ACTIVE';
  return `
  <section class="pass${active ? ' on' : ''}" aria-label="Membership pass">
    <div class="pass-head">
      <div class="pass-brand"><img class="pass-logo" src="${IMG('logo.png')}" alt="AISARC logo"><img class="pass-org" src="${IMG('name.png')}" alt="ស.គ.ឯ.ស.ប.ក AISARC"></div>
      <div class="pass-status"><div class="pass-label">Status</div><span class="pass-pill s-${s.color}">${esc(s.key)}</span></div>
    </div>
    <div class="pass-body">
      <div class="pass-info">
        <div><div class="pass-label">Name</div><div class="pass-val kh">${esc(m.name_kh || '—')}</div><div class="en">${esc(m.name_en || '')}</div></div>
        <div><div class="pass-label">Birthday</div><div class="pass-val">${esc(m.dob || '—')}</div></div>
        <div><div class="pass-label">Membership No.</div><div class="pass-val">${esc(m.member_no || '—')}</div></div>
        <div><div class="pass-label">Member since</div><div class="pass-val">${esc(fmtDate(m.joined_at))}</div></div>
      </div>
      <div class="pass-photo">${photoHtml(m)}</div>
    </div>
    ${active ? '<div class="pass-clock"><i></i><span data-clock></span></div>' : ''}
  </section>`;
}

function reviewReason(m) {
  const r = REJECT_REASONS.find((x) => x.key === m.review?.reason);
  if (!r) return '';
  return `<p><b>${esc(r.kh)}</b><br>${esc(r.en)}</p>${m.review.message ? `<p class="pre">“${esc(m.review.message)}”</p>` : ''}`;
}

// Explains the current status to the member and offers the next action.
function memberNotice(m) {
  const s = m.status;
  if (s === 'REVIEW') return `<div class="notice orange"><h3>កំពុងរង់ចាំការពិនិត្យ · Waiting for review</h3>
    <p>A moderator will review your information soon. Please make sure your profile is complete and correct.</p>
    <div class="actions"><a class="btn sm light" href="#/profile">Check my information</a></div></div>`;
  if (s === 'REJECTED') return `<div class="notice red"><h3>ពាក្យសុំត្រូវបានបដិសេធ · Application rejected</h3>
    ${reviewReason(m)}<p>Please update your information, then submit again.</p>
    <div class="actions"><a class="btn sm light" href="#/profile">Edit my information</a><button class="btn sm" data-submit>Submit for review</button></div></div>`;
  if (s === 'PENDING') return `<div class="notice grey"><h3>សមាជិកភាពផុតកំណត់ · Membership expired</h3>
    <p>Your membership expired on <b>${esc(fmtDate(m.expires_at))}</b>. Please pay the membership fee (see Association) and request renewal.</p>
    <div class="actions"><a class="btn sm light" href="#/association">Payment info</a><button class="btn sm" data-submit>Request renewal</button></div></div>`;
  if (s === 'INACTIVE') return m.consent !== CONSENT_YES
    ? `<div class="notice red"><h3>អសកម្ម · Inactive</h3><p>You have not agreed to the declaration, so your membership is inactive and your information is not used.
       To re-activate, agree to the declaration in your profile.</p><div class="actions"><a class="btn sm light" href="#/profile">Go to my profile</a></div></div>`
    : `<div class="notice red"><h3>អសកម្ម · Inactive</h3><p>Your membership is inactive. You can ask for it to be reviewed again.</p>
       <div class="actions"><button class="btn sm" data-submit>Submit for review</button></div></div>`;
  return '';
}

function bindSubmit(root) {
  root.querySelectorAll('[data-submit]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      state.member = (await api('/api/me/submit', { body: {} })).member;
      toast('Submitted for review ✓');
      route();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  }));
}

function viewPass() {
  const m = state.member;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  app.className = '';
  app.innerHTML = `${header('Your Pass', esc(today))}
    ${passCard(m)}
    <div class="meta-row"><span>Phone <b>${esc(m.phone || '—')}</b></span><span>Valid until <b>${m.expires_at ? esc(fmtDate(m.expires_at)) : '—'}</b></span></div>
    ${memberNotice(m)}
    <div class="card" style="margin-top:16px">
      <h2>${esc(m.name_kh || m.name_en)}</h2>
      <div style="color:var(--muted);font-size:14px">${esc(m.workplace || '')}${m.department ? ` · ${esc(m.department)}` : ''}</div>
      <div class="actions" style="margin-top:14px"><a class="btn block" href="#/profile">${ICON.user} Edit my information</a></div>
    </div>`;
  tickClocks();
  bindSubmit(app);
}

// ---------- member form ----------
function fieldHtml(f, m, role) {
  const editable = canEdit(f, role);
  const v = m[f.key] ?? '';
  const dis = editable ? '' : 'disabled';
  const lbl = `<span class="lbl">${esc(f.kh)}${f.required ? ' *' : ''}${editable || role === 'moderator' ? '' : ' <span class="lock">🔒</span>'}<small>${esc(f.en)}</small></span>`;
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
    const label = (o) => f.labels?.[o] || (f.key === 'status' && STATUS_MAP[o] ? `${o} · ${STATUS_MAP[o].en}` : o);
    input = `<select ${name} ${dis}><option value="">—</option>${opts.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(label(o))}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea ${name} ${dis} rows="2">${esc(v)}</textarea>`;
  } else if (f.type === 'number') {
    input = `<div class="unit"><input type="number" inputmode="decimal" min="0" step="any" ${name} value="${esc(v)}" ${dis}><span>${esc(f.unit)}</span></div>`;
  } else {
    const type = f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text';
    const list = f.list ? `list="dl_${f.key}"` : '';
    input = `<input type="${type}" ${name} ${list} value="${esc(v)}" ${dis} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.required ? 'required' : ''} ${f.upper ? 'style="text-transform:uppercase"' : ''}>`;
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

function collect(form, role, fields = FIELDS) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.key];
    if (!el || (role && !canEdit(f, role))) continue;
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
    ${m.status === 'ACTIVE' ? '' : memberNotice(m)}
    <form id="pf" novalidate>${formHtml(m, 'member')}
      <div class="sticky-save"><button class="btn block" type="submit">Save changes · រក្សាទុក</button></div>
    </form>`;
  const form = $('#pf');
  app.querySelectorAll('.notice a[href="#/profile"]').forEach((a) => a.remove());
  bindSubmit(app);
  bindUploads(form, null, (mm) => { state.member = mm; viewProfile(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const data = collect(form, 'member');
    if (data.consent && data.consent !== CONSENT_YES && m.consent === CONSENT_YES
      && !confirm('If you do not agree to the declaration your membership will become INACTIVE. Continue?')) return;
    btn.disabled = true;
    try {
      const before = m.status;
      const r = await api('/api/me', { method: 'PUT', body: data });
      state.member = r.member;
      toast('Saved ✓');
      if (r.member.status !== before) viewProfile();
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

// ---------- association info ----------
async function viewAssociation(edit = false) {
  app.className = '';
  app.innerHTML = '<div class="spin"></div>';
  let a;
  try { a = await api('/api/association'); } catch (e) { return toast(e.message, true); }
  if (edit && isAdmin()) {
    app.innerHTML = `${header('Association Info', 'Edit · កែប្រែ', '/association')}
      <form id="asf" class="card" novalidate>
        ${ASSOC_FIELDS.map((f) => {
          if (f.type === 'photo') {
            const url = fileUrl(a[f.key]);
            return `<div class="field"><span class="lbl">${esc(f.kh)}<small>${esc(f.en)}</small></span><div class="upload">
              <div class="thumb">${url ? `<img src="${esc(url)}" alt="">` : 'None'}</div>
              <label class="btn sm light">Upload<input type="file" id="qrup" accept="image/*"></label></div></div>`;
          }
          return fieldHtml({ ...f, edit: 'admin' }, a, 'admin');
        }).join('')}
        <button class="btn block" type="submit">Save · រក្សាទុក</button>
      </form>`;
    $('#qrup').addEventListener('change', async (e) => {
      try {
        await api('/api/association/qr', { body: { dataUrl: await readFile(e.target.files[0], 1000) } });
        toast('QR uploaded ✓');
        viewAssociation(true);
      } catch (err) { toast(err.message, true); }
    });
    $('#asf').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/association', { method: 'PUT', body: collect(e.target, null, ASSOC_FIELDS) });
        toast('Saved ✓');
        go('/association');
      } catch (err) { toast(err.message, true); }
    });
    return;
  }
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  const qr = fileUrl(a.qr);
  const term = parseInt(a.term_months, 10);
  app.innerHTML = `${header('Association', 'ព័ត៌មានសមាគម')}
    <section class="card" style="text-align:center">
      <img src="${IMG('logo.png')}" alt="" style="width:88px;height:88px">
      <h2 style="justify-content:center;margin:8px 0 2px;line-height:1.5">${esc(a.name_kh)}</h2>
      <div style="color:var(--muted);font-weight:600">${esc(a.name_en)}</div>
      ${a.about ? `<p class="pre" style="text-align:left;font-size:14px;line-height:1.6">${esc(a.about)}</p>` : ''}
    </section>
    <section class="card">
      <h2>ការបង់ថ្លៃសមាជិកភាព <small>Membership fee payment</small></h2>
      <dl class="kv">
        ${row('Fee', esc(a.fee))}
        ${row('Validity', term ? `${term} ខែ · months` : 'No expiry')}
        ${row('Bank', esc(a.bank_name))}
        ${row('Account name', esc(a.account_name))}
        ${row('Account no.', `<span class="mono-big">${esc(a.account_no)}</span>`)}
        ${row('Currency', esc(a.currency))}
      </dl>
      ${a.account_no ? `<div class="actions" style="margin-top:12px"><button class="btn sm light" id="copyacc">Copy account no.</button></div>` : ''}
      ${qr ? `<img class="qr" src="${esc(qr)}" alt="Payment QR code">` : ''}
      ${a.payment_note ? `<p class="pre" style="font-size:14px;line-height:1.6">${esc(a.payment_note)}</p>` : ''}
    </section>
    ${a.phone || a.telegram || a.email || a.address ? `<section class="card"><h2>ទំនាក់ទំនង <small>Contact</small></h2><dl class="kv">
      ${row('Phone', a.phone ? `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` : '')}
      ${row('Telegram', esc(a.telegram))}
      ${row('Email', a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '')}
      ${row('Address', a.address ? `<span class="pre">${esc(a.address)}</span>` : '')}</dl></section>` : ''}
    ${isAdmin() ? '<a class="btn block light" href="#/association/edit">Edit association info</a>' : ''}`;
  $('#copyacc')?.addEventListener('click', () => navigator.clipboard?.writeText(a.account_no.replace(/\s/g, '')).then(() => toast('Copied ✓')));
}

// ---------- members list (admin + moderator) ----------
let searchTimer;
async function viewAdmin() {
  app.className = 'wide';
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = params.get('q') || '';
  let filter = params.get('s') || (isAdmin() ? 'ALL' : 'REVIEW');
  let selecting = false;
  const selected = new Set();
  app.innerHTML = `${header(isAdmin() ? 'Members' : 'Review', isAdmin() ? 'សមាជិក · Admin' : 'ពិនិត្យសមាជិក · Moderator')}
    <div class="search">${ICON.search}<input id="q" type="search" placeholder="Search name, phone, email, workplace, no…" value="${esc(q)}" autocomplete="off"></div>
    <div class="filters" id="filters"></div>
    <div class="toolbar" id="toolbar"></div>
    <div class="list" id="list"><div class="spin"></div></div>`;
  let rows = [];
  let shown = [];
  const updateUrl = () => {
    const p = new URLSearchParams();
    if ($('#q').value) p.set('q', $('#q').value);
    p.set('s', filter);
    const h = `/admin?${p}`;
    history.replaceState(null, '', `#${h}`);
    sessionStorage.setItem('adminList', h);
  };
  const renderToolbar = () => {
    const count = `<span class="count">${selecting ? `${selected.size} selected` : `${shown.length} member${shown.length === 1 ? '' : 's'}`}</span>`;
    if (!isAdmin()) return ($('#toolbar').innerHTML = count);
    $('#toolbar').innerHTML = selecting
      ? `${count}<button class="btn sm light" data-act="all">${shown.length && shown.every((m) => selected.has(m.id)) ? 'Clear all' : 'Select all'}</button>
         <button class="btn sm" data-act="export-sel" ${selected.size ? '' : 'disabled'}>Export selected</button>
         <button class="btn sm light" data-act="cancel">Cancel</button>`
      : `${count}<a class="btn sm" href="#/admin/new">+ Add</a>
         <button class="btn sm light" data-act="select">Select</button>
         <button class="btn sm light" data-act="export-all" title="Download all members as Excel">Export all</button>`;
  };
  const render = () => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s.key, rows.filter((m) => m.status === s.key).length]));
    $('#filters').innerHTML = [['ALL', 'All', rows.length], ...STATUSES.map((s) => [s.key, s.key[0] + s.key.slice(1).toLowerCase(), counts[s.key]])]
      .map(([k, l, n]) => `<button type="button" data-f="${k}" class="${filter === k ? 'on' : ''}">${l}<b>${n}</b></button>`).join('');
    shown = filter === 'ALL' ? rows : rows.filter((m) => m.status === filter);
    $('#list').innerHTML = shown.length ? shown.map((m) => `
      <a class="mrow${selecting && selected.has(m.id) ? ' sel' : ''}" href="#/admin/m/${m.id}" data-id="${m.id}">
        ${selecting ? `<input type="checkbox" class="pick" tabindex="-1" ${selected.has(m.id) ? 'checked' : ''} aria-label="Select">` : ''}
        <div class="avatar">${photoHtml(m)}</div>
        <div class="info"><div class="n1">${esc(m.name_kh)} · ${esc(m.name_en)}</div>
          <div class="n2">${esc(m.member_no || 'New applicant')} · ${esc(m.phone || m.email || '')}</div>
          <div class="n2">${esc(m.workplace || '')}</div></div>
        ${chip(m)}
      </a>`).join('') : '<div class="empty">No members found</div>';
    renderToolbar();
  };
  const load = async (term) => {
    try { rows = await api(`/api/members?q=${encodeURIComponent(term)}`); render(); } catch (e) { toast(e.message, true); }
  };
  updateUrl();
  load(q);
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    updateUrl();
    render();
  });
  $('#q').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { updateUrl(); load($('#q').value); }, 200);
  });
  // In select mode, tapping a row toggles it instead of opening the member.
  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('.mrow');
    if (!row || !selecting) return;
    e.preventDefault();
    const id = Number(row.dataset.id);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    render();
  });
  $('#toolbar').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'select') { selecting = true; render(); }
    if (act === 'cancel') { selecting = false; selected.clear(); render(); }
    if (act === 'all') {
      const all = shown.every((m) => selected.has(m.id));
      shown.forEach((m) => (all ? selected.delete(m.id) : selected.add(m.id)));
      render();
    }
    if (act === 'export-all') location.href = '/api/export.xlsx';
    if (act === 'export-sel' && selected.size) location.href = `/api/export.xlsx?ids=${[...selected].join(',')}`;
  });
}

// Status info for moderators/admins on the member page.
function staffNotice(m) {
  const s = statusOf(m);
  const by = m.review?.by ? ` by <b>${esc(m.review.by)}</b> · ${esc(fmtDateTime(m.review.at))}` : '';
  if (s.key === 'REVIEW') return `<div class="notice orange"><h3>Waiting for review</h3><p>${m.applied_at ? `Submitted ${esc(fmtDateTime(m.applied_at))}. ` : ''}Check the information and documents, then approve or reject.</p></div>`;
  if (s.key === 'REJECTED') return `<div class="notice red"><h3>Rejected</h3>${reviewReason(m)}<p>${by}</p></div>`;
  if (s.key === 'PENDING') return `<div class="notice grey"><h3>Expired</h3><p>Membership expired on ${esc(fmtDate(m.expires_at))}. Waiting for the member to renew.</p></div>`;
  if (s.key === 'INACTIVE') return `<div class="notice red"><h3>Inactive</h3><p>${m.consent === CONSENT_YES ? 'Deactivated.' : 'Member did not agree to the declaration.'}</p></div>`;
  return `<div class="notice green"><h3>Active</h3><p>Valid until ${m.expires_at ? esc(fmtDate(m.expires_at)) : 'no expiry'}.${m.review?.decision === 'approved' ? ` Approved${by}` : ''}</p></div>`;
}

function rejectDialog(id, onDone) {
  const d = modal(`<form method="dialog" id="rj">
    <h3 style="margin-top:0">Reject application · បដិសេធ</h3>
    <p style="font-size:14px;color:var(--muted);margin-top:0">The member will see this reason and can fix their information.</p>
    <div class="radio-list">${REJECT_REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${r.key}" ${i === 0 ? 'checked' : ''}>
      <span><b>${esc(r.kh)}</b><br>${esc(r.en)}</span></label>`).join('')}</div>
    <label class="field"><span class="lbl">Message to member<small>What is missing or wrong? (required for "Other")</small></span>
      <textarea name="message" rows="3" placeholder="e.g. Please upload your Council certificate and photo"></textarea></label>
    <div class="actions"><button type="button" class="btn light" value="cancel" data-close>Cancel</button><button class="btn" style="background:var(--danger)" type="submit">Reject</button></div>
  </form>`);
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelector('#rj').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      const m = await api(`/api/members/${id}/review`, { body: { decision: 'reject', reason: f.reason.value, message: f.message.value } });
      d.close();
      toast('Rejected');
      onDone(m);
    } catch (err) { toast(err.message, true); }
  });
}

async function viewAdminEdit(id) {
  app.className = 'wide';
  const isNew = id === 'new';
  const admin = isAdmin();
  if (isNew && !admin) return go('/admin');
  let m = { status: 'ACTIVE', consent: CONSENT_YES };
  if (!isNew) {
    app.innerHTML = '<div class="spin"></div>';
    try { m = await api(`/api/members/${id}`); } catch (e) { toast(e.message, true); return go('/admin'); }
  }
  const back = sessionStorage.getItem('adminList') || '/admin';
  const role = admin ? 'admin' : 'moderator';
  const s = m.status;
  const reviewBtns = s === 'REVIEW' || (admin && ['REJECTED'].includes(s))
    ? `<button class="btn sm" id="approve" style="background:var(--ok)">✓ Approve</button><button class="btn sm danger" id="reject">✕ Reject</button>` : '';
  const adminBtns = admin && !isNew ? `
      ${s !== 'ACTIVE' && s !== 'REVIEW' ? '<button class="btn sm" id="activate" style="background:var(--ok)">Activate</button>' : ''}
      ${s !== 'INACTIVE' ? '<button class="btn sm light" id="deactivate">Deactivate</button>' : ''}
      <button class="btn sm light" id="reset">${ICON.key} Reset password</button>` : '';
  app.innerHTML = `${header(isNew ? 'New member' : esc(m.member_no || 'New applicant'), '', back)}
    <div class="admin-edit">
      <div class="side">
        ${isNew ? '' : passCard(m) + staffNotice(m)}
        ${isNew ? '' : `<div class="actions">${reviewBtns}${adminBtns}</div>`}
        ${admin && !isNew && m.email ? `<section class="card" style="margin-top:14px"><h2>Account <small>Login: ${esc(m.username || m.email)}</small></h2>
          <label class="field"><span class="lbl">Role<small>Moderators can approve / reject applications</small></span>
          <select id="role">${ROLES.map((r) => `<option value="${r.key}" ${(m.role || 'member') === r.key ? 'selected' : ''}>${esc(r.en)}</option>`).join('')}</select></label></section>` : ''}
      </div>
      <div>
        <form id="af" novalidate>${formHtml(m, role)}
          ${admin ? `<div class="sticky-save"><button class="btn block" type="submit">${isNew ? 'Create member' : 'Save changes'}</button></div>` : ''}
        </form>
        ${admin && !isNew ? `<details class="danger"><summary>Danger zone · លុបសមាជិក</summary>
          <p>Deleting removes this member, their login and uploaded files permanently. To confirm, type <b>${esc(m.member_no || m.email)}</b> below.</p>
          <div class="actions"><input id="delconfirm" autocomplete="off" style="flex:1;min-width:160px"><button class="btn danger" id="del" disabled>Delete permanently</button></div>
        </details>` : ''}
      </div>
    </div>`;
  tickClocks();
  const reload = () => viewAdminEdit(id);
  if (isNew) app.querySelectorAll('[data-upload]').forEach((el) => el.closest('label').replaceWith('Save first, then upload'));
  const form = $('#af');
  if (admin) bindUploads(form, m.id, reload);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api(isNew ? '/api/members' : `/api/members/${id}`, { method: isNew ? 'POST' : 'PUT', body: collect(form, 'admin') });
      toast('Saved ✓');
      isNew ? go(`/admin/m/${r.id}`) : reload();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  $('#approve')?.addEventListener('click', async () => {
    if (!confirm(`Approve ${m.name_en || 'this member'}? They will become ACTIVE.`)) return;
    try { await api(`/api/members/${id}/review`, { body: { decision: 'approve' } }); toast('Approved ✓'); reload(); } catch (err) { toast(err.message, true); }
  });
  $('#reject')?.addEventListener('click', () => rejectDialog(id, reload));
  const setStatus = async (status) => {
    try { await api(`/api/members/${id}/status`, { body: { status } }); toast(`Now ${status}`); reload(); } catch (err) { toast(err.message, true); }
  };
  $('#activate')?.addEventListener('click', () => setStatus('ACTIVE'));
  $('#deactivate')?.addEventListener('click', () => confirm('Deactivate this member?') && setStatus('INACTIVE'));
  $('#role')?.addEventListener('change', async (e) => {
    try { await api(`/api/members/${id}/role`, { method: 'PUT', body: { role: e.target.value } }); toast('Role updated ✓'); } catch (err) { toast(err.message, true); }
  });
  $('#reset')?.addEventListener('click', async () => {
    if (!confirm('Generate a new temporary password for this member?')) return;
    try {
      const r = await api(`/api/members/${id}/password`, { body: {} });
      const d = modal(`<h3 style="margin-top:0">Temporary password</h3><p>Share with the member. They must change it after signing in.</p>
        <div class="field"><span class="lbl">Username</span><div class="mono">${esc(r.username)}</div></div>
        <div class="field"><span class="lbl">Password</span><div class="mono">${esc(r.password)}</div></div>
        <button class="btn block" data-close>Done</button>`);
      d.querySelector('[data-close]').onclick = () => d.close();
    } catch (err) { toast(err.message, true); }
  });
  const delInput = $('#delconfirm');
  delInput?.addEventListener('input', () => { $('#del').disabled = delInput.value.trim() !== (m.member_no || m.email); });
  $('#del')?.addEventListener('click', async () => {
    try {
      await api(`/api/members/${id}`, { method: 'DELETE', body: { confirm: delInput.value.trim() } });
      toast('Deleted');
      go('/admin');
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- admin section: system users + backup / restore ----------
async function viewSystem() {
  app.className = '';
  app.innerHTML = `${header('Admin', 'គ្រប់គ្រងប្រព័ន្ធ · System')}
    <section class="card"><h2>អ្នកប្រើប្រព័ន្ធ <small>System users</small></h2>
      <p class="hint" style="text-align:left;margin-top:0">Admins have full access. Moderators can review members and manage events.</p>
      <div id="users"><div class="spin"></div></div>
    </section>
    <form class="card" id="nu" autocomplete="off">
      <h2>បន្ថែមអ្នកប្រើ <small>Add system user</small></h2>
      <div class="grid2">
        <label class="field"><span class="lbl">Username</span><input name="username" required autocapitalize="none"></label>
        <label class="field"><span class="lbl">Role</span><select name="role"><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
        <label class="field"><span class="lbl">Temporary password<small>At least 8 characters – they must change it at first sign-in</small></span><input name="password" type="text" minlength="8" required></label>
      </div>
      <button class="btn block" type="submit">Create user</button>
      <p class="hint" style="text-align:left">To give a <b>member</b> moderator/admin rights, open them in Members → Account → Role.</p>
    </form>
    <section class="card"><h2>បម្រុងទុក និង ស្ដារ <small>Backup &amp; restore</small></h2>
      <p style="font-size:14px;margin-top:0">The backup contains the whole database (members, logins, events, association info) and all uploaded photos/files.</p>
      <div class="actions"><a class="btn" href="/api/backup">⬇ Download backup</a></div>
      <details class="danger"><summary>Restore from a backup file</summary>
        <p>Restoring <b>replaces all current data</b> with the backup and signs everyone out. A safety copy of the current data is saved on the server first.</p>
        <div class="actions"><input type="file" id="rfile" accept=".gz,.json,application/gzip" style="flex:1;min-width:200px"><button class="btn danger" id="restore" disabled>Restore</button></div>
      </details>
    </section>
    <a class="btn block light" href="#/association/edit">Edit association info</a>`;

  const loadUsers = async () => {
    try {
      const users = await api('/api/users');
      $('#users').innerHTML = `<div class="ulist">${users.map((u) => `
        <div class="urow" data-id="${u.id}">
          <div class="info"><div class="n1">${esc(u.username)}${u.id === state.user.id ? ' <small>(you)</small>' : ''}</div>
            <div class="n2">${u.member_no ? `Member ${esc(u.member_no)} · ${esc(u.name || '')}` : 'System account'}</div></div>
          <select data-role ${u.id === state.user.id ? 'disabled' : ''}>
            ${(u.member_id ? ['member', 'moderator', 'admin'] : ['moderator', 'admin']).map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <button class="icon-btn" data-reset title="Reset password">${ICON.key}</button>
          ${u.id === state.user.id ? '' : `<button class="icon-btn" data-del title="${u.member_id ? 'Remove staff role' : 'Delete user'}">✕</button>`}
        </div>`).join('')}</div>`;
    } catch (e) { toast(e.message, true); }
  };
  loadUsers();

  $('#users').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-role]')) return;
    const id = e.target.closest('.urow').dataset.id;
    try { await api(`/api/users/${id}`, { method: 'PUT', body: { role: e.target.value } }); toast('Role updated ✓'); } catch (err) { toast(err.message, true); }
    loadUsers();
  });
  $('#users').addEventListener('click', async (e) => {
    const row = e.target.closest('.urow');
    if (!row) return;
    const name = row.querySelector('.n1').textContent;
    if (e.target.closest('[data-del]')) {
      if (!confirm(`Remove ${name}?`)) return;
      try { await api(`/api/users/${row.dataset.id}`, { method: 'DELETE', body: {} }); toast('Removed'); loadUsers(); } catch (err) { toast(err.message, true); }
    }
    if (e.target.closest('[data-reset]')) {
      if (!confirm(`Generate a new temporary password for ${name}?`)) return;
      try {
        const r = await api(`/api/users/${row.dataset.id}/password`, { body: {} });
        const d = modal(`<h3 style="margin-top:0">Temporary password</h3>
          <div class="field"><span class="lbl">Username</span><div class="mono">${esc(r.username)}</div></div>
          <div class="field"><span class="lbl">Password</span><div class="mono">${esc(r.password)}</div></div>
          <button class="btn block" data-close>Done</button>`);
        d.querySelector('[data-close]').onclick = () => d.close();
      } catch (err) { toast(err.message, true); }
    }
  });
  $('#nu').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      await api('/api/users', { body: { username: f.username.value.trim(), role: f.role.value, password: f.password.value } });
      toast('User created ✓');
      e.target.reset();
      loadUsers();
    } catch (err) { toast(err.message, true); }
  });
  $('#rfile').addEventListener('change', (e) => { $('#restore').disabled = !e.target.files[0]; });
  $('#restore').addEventListener('click', async () => {
    const file = $('#rfile').files[0];
    if (!file || !confirm(`Restore "${file.name}"?\n\nALL current data will be replaced and everyone will be signed out.`)) return;
    $('#restore').disabled = true;
    toast('Restoring…');
    try {
      const res = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, credentials: 'same-origin' });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Restore failed');
      alert(`Restore complete.\nMembers: ${r.counts.members}, users: ${r.counts.users}, events: ${r.counts.events || 0}, files: ${r.counts.files}\n\nPlease sign in again.`);
      state.user = null;
      state.checked = true;
      go('/login');
    } catch (err) { toast(err.message, true); $('#restore').disabled = false; }
  });
}

// ---------- events ----------
const fmtEventTime = (e) => {
  const start = new Date(e.starts_at);
  const day = start.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const t = (d) => d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t(start)}${e.ends_at ? `–${t(new Date(e.ends_at))}` : ''}`;
};
const seatsText = (e) => (e.seats ? `${e.joined_count} / ${e.seats} joined · ${e.seats_left} left` : `${e.joined_count} joined · unlimited seats`);
const seatBar = (e) => (e.seats ? `<div class="bar"><i style="width:${Math.min(100, (e.joined_count / e.seats) * 100)}%"></i></div>` : '');

let livePoll;
async function viewEvents() {
  app.className = '';
  app.innerHTML = `${header('Events', 'ព្រឹត្តិការណ៍')}
    ${isStaff() ? '<div class="actions" style="margin-bottom:12px"><a class="btn" href="#/events/new">+ New event</a></div>' : ''}
    <div class="elist" id="elist"><div class="spin"></div></div>`;
  const load = async () => {
    if (!$('#elist')) return clearInterval(livePoll);
    try {
      const evs = await api('/api/events');
      $('#elist').innerHTML = evs.length ? evs.map((e) => `
        <a class="ecard${e.past ? ' past' : ''}" href="#/events/${e.id}">
          <div class="edate"><b>${esc(new Date(e.starts_at).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' }))}</b>
            <span>${esc(new Date(e.starts_at).toLocaleDateString('en-GB', { timeZone: TZ, month: 'short' }))}</span></div>
          <div class="info"><div class="n1">${esc(e.title)}</div>
            <div class="n2">${ICON.clock}${esc(fmtEventTime(e))}</div>
            ${e.location ? `<div class="n2">${ICON.pin}${esc(e.location)}</div>` : ''}
            <div class="n2">${ICON.seat}${esc(seatsText(e))}</div>${seatBar(e)}</div>
          ${e.joined ? '<span class="chip c-green">Joined</span>' : e.past ? '<span class="chip c-grey">Ended</span>' : e.seats && !e.seats_left ? '<span class="chip c-red">Full</span>' : ''}
        </a>`).join('') : '<div class="empty">No events yet</div>';
    } catch (err) { toast(err.message, true); }
  };
  await load();
  clearInterval(livePoll);
  livePoll = setInterval(load, 15000);
}

async function viewEvent(id) {
  app.className = '';
  app.innerHTML = '<div class="spin"></div>';
  const render = (e) => {
    const canJoin = state.user.member_id && !e.past;
    const member = state.member;
    const full = e.seats && !e.seats_left;
    app.innerHTML = `${header('Event', 'ព្រឹត្តិការណ៍', '/events')}
      <section class="card event-detail">
        <h2 style="font-size:20px;line-height:1.4">${esc(e.title)}</h2>
        <dl class="kv">
          <dt>${ICON.clock}</dt><dd>${esc(fmtEventTime(e))}</dd>
          ${e.location ? `<dt>${ICON.pin}</dt><dd>${esc(e.location)}</dd>` : ''}
          <dt>${ICON.seat}</dt><dd><span class="live-dot"></span><span id="seats">${esc(seatsText(e))}</span>${seatBar(e)}</dd>
        </dl>
        ${e.description ? `<p class="pre" style="font-size:14px;line-height:1.7">${esc(e.description)}</p>` : ''}
        ${canJoin ? (e.joined
          ? '<div class="notice green" style="margin-bottom:0"><b>✓ You joined this event</b><div class="actions"><button class="btn sm light" id="leave">Cancel my seat</button></div></div>'
          : member?.status !== 'ACTIVE' ? '<div class="notice grey" style="margin-bottom:0">Only ACTIVE members can join events.</div>'
          : `<button class="btn block" id="join" ${full ? 'disabled' : ''}>${full ? 'Event is full' : 'Join this event · ចូលរួម'}</button>`)
          : e.past ? '<div class="notice grey" style="margin-bottom:0">This event has ended.</div>' : ''}
      </section>
      <section class="card"><h2>អ្នកចូលរួម <small>Joined members (${e.joined_count}) · live</small></h2>
        ${e.participants.length ? `<div class="plist">${e.participants.map((p, i) => `
          <div class="prow"><span class="pn">${i + 1}</span><div class="info"><div class="n1">${esc(p.name_kh)} · ${esc(p.name_en)}</div>
          ${p.member_no ? `<div class="n2">${esc(p.member_no)} · ${esc(p.phone || '')}</div>` : ''}</div></div>`).join('')}</div>`
          : '<div class="empty" style="padding:16px 0">No one has joined yet</div>'}
      </section>
      ${isStaff() ? `<div class="actions"><a class="btn light" href="#/events/${e.id}/edit">Edit event</a><button class="btn danger" id="edel">Delete event</button></div>` : ''}`;
    const act = async (method) => {
      try { await api(`/api/events/${id}/join`, { method, body: {} }); toast(method === 'POST' ? 'Joined ✓' : 'Seat cancelled'); refresh(); } catch (err) { toast(err.message, true); refresh(); }
    };
    $('#join')?.addEventListener('click', () => act('POST'));
    $('#leave')?.addEventListener('click', () => confirm('Cancel your seat?') && act('DELETE'));
    $('#edel')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${e.title}"? Everyone who joined will be removed.`)) return;
      try { await api(`/api/events/${id}`, { method: 'DELETE', body: {} }); toast('Event deleted'); go('/events'); } catch (err) { toast(err.message, true); }
    });
  };
  const refresh = async () => {
    try { render(await api(`/api/events/${id}`)); } catch (err) { toast(err.message, true); clearInterval(livePoll); go('/events'); }
  };
  await refresh();
  // Live seat count: refresh while this page is open (skip while the user is interacting with a dialog).
  clearInterval(livePoll);
  livePoll = setInterval(() => {
    if (!location.hash.startsWith(`#/events/${id}`) || location.hash.endsWith('/edit')) return clearInterval(livePoll);
    if (!document.querySelector('dialog[open]')) refresh();
  }, 5000);
}

async function viewEventEdit(id) {
  app.className = '';
  const isNew = id === 'new';
  let e = { title: '', location: '', description: '', seats: 0, starts_at: '', ends_at: '' };
  if (!isNew) {
    try { e = await api(`/api/events/${id}`); } catch (err) { toast(err.message, true); return go('/events'); }
  }
  app.innerHTML = `${header(isNew ? 'New event' : 'Edit event', 'ព្រឹត្តិការណ៍', isNew ? '/events' : `/events/${id}`)}
    <form class="card" id="ef" novalidate>
      <label class="field"><span class="lbl">ឈ្មោះព្រឹត្តិការណ៍ *<small>Event name</small></span><input name="title" required value="${esc(e.title)}"></label>
      <label class="field"><span class="lbl">ទីកន្លែង<small>Location</small></span><input name="location" value="${esc(e.location)}"></label>
      <div class="grid2" style="margin-bottom:14px">
        <label class="field"><span class="lbl">ចាប់ផ្ដើម *<small>Starts (date &amp; time)</small></span><input type="datetime-local" name="starts_at" required value="${esc(toLocalInput(e.starts_at))}"></label>
        <label class="field"><span class="lbl">បញ្ចប់<small>Ends (optional)</small></span><input type="datetime-local" name="ends_at" value="${esc(toLocalInput(e.ends_at))}"></label>
      </div>
      <label class="field"><span class="lbl">ចំនួនកៅអី<small>Seats available (0 = unlimited)</small></span>
        <div class="unit"><input type="number" name="seats" min="0" step="1" inputmode="numeric" value="${esc(e.seats)}"><span>កៅអី</span></div></label>
      <label class="field"><span class="lbl">ការពិពណ៌នា<small>Description</small></span><textarea name="description" rows="6">${esc(e.description)}</textarea></label>
      <button class="btn block" type="submit">${isNew ? 'Publish event' : 'Save changes'}</button>
    </form>`;
  $('#ef').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target.elements;
    const body = {
      title: f.title.value, location: f.location.value, description: f.description.value, seats: f.seats.value,
      starts_at: fromLocalInput(f.starts_at.value), ends_at: fromLocalInput(f.ends_at.value),
    };
    try {
      const r = await api(isNew ? '/api/events' : `/api/events/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast('Saved ✓');
      go(`/events/${r.id}`);
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- login / register ----------
const brand = `<div class="brand"><img src="${IMG('logo.png')}" alt="AISARC logo"><img class="name" src="${IMG('name.png')}" alt="ស.គ.ឯ.ស.ប.ក AISARC">
  <p>ប្រព័ន្ធគ្រប់គ្រងសមាជិក · Membership Portal</p></div>`;

function viewLogin() {
  tabbar.hidden = true;
  app.className = '';
  app.innerHTML = `<div class="login">${brand}
    <form class="card" id="lf">
      <label class="field"><span class="lbl">Username / Email<small>ឈ្មោះអ្នកប្រើ ឬ អ៊ីម៉ែល</small></span><input name="username" autocomplete="username" required autocapitalize="none"></label>
      <label class="field"><span class="lbl">Password<small>ពាក្យសម្ងាត់</small></span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn block" type="submit">Sign in · ចូល</button>
      <p class="err" id="lerr"></p>
      <div id="gwrap" hidden><div class="divider">or</div><div id="gbtn"></div></div>
      <div class="divider">New member? · សមាជិកថ្មី?</div>
      <a class="btn block light" href="#/register">Register · ចុះឈ្មោះ</a>
      <p class="hint">Existing members: your first password is your phone number. Forgot it? Contact the AISARC admin.</p>
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
  const err = new URLSearchParams(location.hash.split('?')[1] || '').get('error');
  if (err) $('#lerr').textContent = err;
}

function viewRegister() {
  tabbar.hidden = true;
  app.className = '';
  app.innerHTML = `<div class="login">${brand}
    <form class="card" id="rf" novalidate>
      <h2>ចុះឈ្មោះជាសមាជិក <small>Register as a member</small></h2>
      <label class="field"><span class="lbl">គោត្តនាម និង នាមខ្លួន *<small>Full name (Khmer)</small></span><input name="name_kh" required></label>
      <label class="field"><span class="lbl">ឈ្មោះជាអក្សរឡាតាំង *<small>Full name (Latin)</small></span><input name="name_en" required style="text-transform:uppercase"></label>
      <label class="field"><span class="lbl">អ៊ីម៉ែល *<small>Email – used to sign in (also with Google)</small></span><input name="email" type="email" required autocomplete="email" autocapitalize="none"></label>
      <label class="field"><span class="lbl">លេខទូរស័ព្ទ<small>Phone</small></span><input name="phone" type="tel" autocomplete="tel"></label>
      <label class="field"><span class="lbl">ពាក្យសម្ងាត់ *<small>Password – at least 8 characters</small></span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <label class="field"><span class="lbl">បញ្ជាក់ពាក្យសម្ងាត់ *<small>Confirm password</small></span><input name="confirm" type="password" required autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="consent"><span>${esc(DECLARATION)}</span></label>
      <button class="btn block" type="submit">Register · ចុះឈ្មោះ</button>
      <p class="err" id="rerr"></p>
      <p class="hint">After registering, complete your profile. A moderator will review and approve your membership.</p>
      <a class="btn block light" href="#/login">Back to sign in</a>
    </form></div>`;
  $('#rf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (f.password.value !== f.confirm.value) return ($('#rerr').textContent = 'Passwords do not match');
    if (!f.consent.checked) return ($('#rerr').textContent = 'Please agree to the declaration · សូមយល់ព្រមលើសេចក្តីប្រកាស');
    try {
      const r = await api('/api/register', { body: {
        name_kh: f.name_kh.value, name_en: f.name_en.value, email: f.email.value, phone: f.phone.value, password: f.password.value, consent: true,
      } });
      state.user = r.user;
      state.member = (await api('/api/me')).member;
      toast('Registered ✓ Please complete your profile');
      go('/profile');
    } catch (err) { $('#rerr').textContent = err.message; }
  });
}

function initGoogle() {
  const cid = state.config?.googleClientId;
  if (!cid) return;
  const render = () => {
    const redirect = state.config.googleRedirectUri;
    google.accounts.id.initialize({
      client_id: cid,
      ...(redirect ? { ux_mode: 'redirect', login_uri: redirect } : {}),
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

const home = () => (state.user?.member_id ? '/pass' : isStaff() ? '/admin' : '/association');

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
  if (!state.user) {
    if (path === '/register') return viewRegister();
    return path === '/login' ? viewLogin() : go('/login');
  }
  if (['/login', '/register', '/'].includes(path)) return go(home());
  if (state.user.must_change && path !== '/password') return go('/password');

  window.scrollTo(0, 0);
  clearInterval(livePoll);
  if (path === '/pass' && state.member) { setTabs('/pass'); return viewPass(); }
  if (path === '/profile' && state.member) { setTabs('/profile'); return viewProfile(); }
  if (path === '/password') { setTabs(''); return viewPassword(); }
  if (path === '/events') { setTabs('/events'); return viewEvents(); }
  const ev = path.match(/^\/events\/(\d+|new)(\/edit)?$/);
  if (ev) {
    setTabs('/events');
    if (ev[1] === 'new' || ev[2]) return isStaff() ? viewEventEdit(ev[1]) : go('/events');
    return viewEvent(ev[1]);
  }
  if (path === '/association') { setTabs('/association'); return viewAssociation(); }
  if (path === '/association/edit' && isAdmin()) { setTabs('/system'); return viewAssociation(true); }
  if (path === '/system' && isAdmin()) { setTabs('/system'); return viewSystem(); }
  if (path === '/admin' && isStaff()) { setTabs('/admin'); return viewAdmin(); }
  const mm = path.match(/^\/admin\/(?:m\/(\d+)|(new))$/);
  if (mm && isStaff()) { setTabs('/admin'); return viewAdminEdit(mm[1] || mm[2]); }
  go(home());
}

window.addEventListener('hashchange', route);
route();
