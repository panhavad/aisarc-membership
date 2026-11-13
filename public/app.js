import {
  FIELDS, SECTIONS, STATUSES, STATUS_MAP, ROLES, REJECT_REASONS, ASSOC_FIELDS, DECLARATION, CONSENT_YES, canEdit,
  SUBMIT_REQUIRED, missingForReview,
} from './fields.js';
import { startTour, maybeAutoTour, tourKind } from './tour.js';
import { PRIVACY, PRIVACY_VERSION } from './privacy.js';

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
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3l7.5-7.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10M7 21h10M8 3v3.5c0 2 4 3.5 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.5-4 5.5s4 3.5 4 5.5V21"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2.5 21h19M10 21v-4h4v4M12 7v4M10 9h4"/></svg>',
  cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c2 2 10 2 12 0v-5M22 9v6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4 2.5 11.3c-.7.3-.7 1.3 0 1.5l4.8 1.6 1.8 5.6c.2.6 1 .8 1.4.3l2.7-2.9 4.9 3.6c.5.4 1.3.1 1.4-.5L22.5 5c.2-.7-.4-1.3-1-1Z"/><path d="m7.3 14.4 10.7-7.6-8 8.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9Z"/></svg>',
  shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 4 5.5 2.5 10l3.5 1.5V21h12v-9.5l3.5-1.5L20 5.5 15 3c-.5 1.5-1.6 2.5-3 2.5S9.5 4.5 9 3Z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  idcard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.3 1.6-2 3-2s2.5.7 3 2M14.5 10h4M14.5 13.5h3"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20.5h18"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};
// Inline icon that sits in a line of text (no emoji anywhere in the UI).
const ic = (name) => ICON[name].replace('<svg ', '<svg class="ic" aria-hidden="true" ');

// Every form field shows a leading icon, chosen by the field's name (or its type), so fields are easy to tell apart.
const FIELD_ICON = {
  name_kh: 'user', name_en: 'user', username: 'user', gender: 'user', age_group: 'users', account_name: 'user',
  email: 'mail', contact_email: 'mail', phone: 'phone', telegram: 'telegram',
  password: 'lock', confirm: 'lock', current: 'lock', bpass: 'lock', rpass: 'lock',
  dob: 'cal', cnc_reg_date: 'cal', joined_at: 'cal', expires_at: 'cal', starts_at: 'cal', ends_at: 'cal', mm: 'cal', dd: 'cal', term_months: 'cal', edit_days: 'cal', inactive_years: 'cal',
  birthplace: 'pin', address: 'pin', location: 'pin', map_url: 'link', nationality: 'flag', tshirt: 'shirt',
  occupation: 'briefcase', employment: 'briefcase', workplace: 'building', department: 'building', experience: 'clock',
  training: 'cap', highest_degree: 'cap', general_education: 'cap', other_degree: 'cap',
  cnc_reg_no: 'idcard', member_no: 'idcard', status: 'flag', level: 'star', consent: 'shield', role: 'shield',
  title: 'cal', seats: 'seat', price: 'cash', fee: 'cash', currency: 'cash', close_days: 'hourglass',
  bank_name: 'bank', account_no: 'idcard', about: 'note', payment_note: 'note', description: 'note', note: 'note', message: 'note', reason: 'note',
  name: 'org', 'req-note': 'note', psize: 'list', arange: 'clock',
};
const TYPE_ICON = { email: 'mail', tel: 'phone', password: 'lock', date: 'cal', 'datetime-local': 'cal', url: 'link', number: 'tag' };
const SKIP_TYPES = new Set(['checkbox', 'radio', 'file', 'color', 'hidden', 'submit', 'button']);
function decorateFields(root = document) {
  root.querySelectorAll('.field input, .field select, .field textarea, .unit > input').forEach((el) => {
    if (SKIP_TYPES.has(el.type) || el.closest('.ctl, .search')) return;
    const key = (el.name || el.id || '').replace(/^f_/, '');
    const org = el.closest('#asf') && ['name_kh', 'name_en'].includes(key) ? 'org' : '';
    const icon = el.dataset.icon || org || FIELD_ICON[key] || TYPE_ICON[el.type] || (el.tagName === 'TEXTAREA' ? 'note' : el.tagName === 'SELECT' ? 'list' : 'edit');
    const wrap = document.createElement('span');
    wrap.className = `ctl${el.tagName === 'TEXTAREA' ? ' ta' : ''}`;
    if (icon === 'edit' && !el.dataset.icon) wrap.dataset.fallback = key || '?';
    el.before(wrap);
    wrap.insertAdjacentHTML('afterbegin', ic(icon));
    wrap.append(el);
  });
}
// Runs right after every render (pages, dialogs), before the browser paints; only when form fields were added.
const hasFields = (n) => n.nodeType === 1 && (n.matches('input, select, textarea, .field') || n.querySelector('.field, .unit'));

// Bilingual text "English · ខ្មែរ" (or "ខ្មែរ · English"): the part after the dot is kept in one piece, so when the
// line is too short it moves to its own line instead of being cut in the middle of a word.
const KH = /[\u1780-\u17FF]/;
const BI_SKIP = 'script, style, textarea, select, option, input, button, .btn, .mrow, .chip, .flag, .pass, #tabbar, .filters, .pg-nav, .ecard, .prow, .sk-wrap, .bi, .n1, .unit, svg';
function decorateBilingual(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.data.includes(' · ') && KH.test(n.data) && /[A-Za-z]/.test(n.data) && !n.parentElement?.closest(BI_SKIP)) nodes.push(n);
  }
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    n.data.split(' · ').forEach((part, i) => {
      if (i === 0) return frag.append(part);
      frag.append('\u00a0· '); // the dot stays at the end of the first line
      const [, text, space] = /^([\s\S]*?)(\s*)$/.exec(part);
      const span = document.createElement('span');
      span.className = 'bi';
      span.textContent = text;
      frag.append(span);
      if (space) frag.append(space);
    });
    n.replaceWith(frag);
  }
}
new MutationObserver((list) => {
  if (list.some((m) => [...m.addedNodes].some(hasFields))) decorateFields();
  for (const m of list) for (const n of m.addedNodes) decorateBilingual(n.nodeType === 3 ? n.parentElement : n.nodeType === 1 ? n : null);
}).observe(document.body, { childList: true, subtree: true });

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
  if (res.status === 403 && data.must_change && state.user) { state.user.must_change = true; go('/password'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
// Skeleton placeholders ("lazy loader") shown in the shape of the content while it loads – no spinners.
const skLine = (w, h = 12) => `<span class="sk sk-line" style="width:${w}%;height:${h}px"></span>`;
const skRep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
function skeleton(kind, n = 3) {
  const wrap = (html, cls = '') => `<div class="sk-wrap ${cls}" aria-busy="true" aria-label="Loading">${html}</div>`;
  if (kind === 'rows') return wrap(skRep(n, (i) => `<div class="mrow sk-row"><span class="sk sk-avatar"></span>
    <div class="info">${skLine(50 + (i % 3) * 10, 14)}${skLine(40)}${skLine(60 - (i % 2) * 15)}</div><span class="sk sk-chip"></span></div>`), 'list');
  if (kind === 'events') return wrap(skRep(n, (i) => `<div class="ecard sk-row"><span class="sk sk-date"></span>
    <div class="info">${skLine(70 - (i % 2) * 15, 16)}${skLine(55)}${skLine(45)}${skLine(35)}</div></div>`), 'elist');
  if (kind === 'lines') return wrap(skRep(n, (i) => `<div class="sk-lines">${skLine(85 - (i % 3) * 15, 13)}${skLine(45 + (i % 2) * 20)}</div>`));
  if (kind === 'member') return wrap(`<div class="sk-head">${skLine(30, 28)}</div><div class="admin-edit"><div class="side">
    <span class="sk sk-block sk-pass"></span>${skLine(80, 44)}</div><div>${skRep(3, () => `<div class="card">${skLine(35, 16)}
    <div class="grid2">${skRep(4, () => `<div class="sk-field">${skLine(40)}<span class="sk sk-input"></span></div>`)}</div></div>`)}</div></div>`);
  // A generic page: title, then a few cards with lines.
  return wrap(`<div class="sk-head">${skLine(45, 28)}${skLine(25)}</div>${skRep(n, (i) => `<div class="card">${skLine(40, 16)}
    ${skRep(3 + (i % 2), (j) => skLine(90 - j * 12))}</div>`)}`);
}

function toast(msg, error = false) {
  const t = $('#toast');
  t.innerHTML = `${ic(error ? 'alert' : 'check')}<span></span>`;
  t.querySelector('span').textContent = msg;
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
  v = String(v);
  if (v.startsWith('file:')) return `/api/files/${encodeURIComponent(v.slice(5))}`;
  const drive = v.match(/^https:\/\/drive\.google\.com\/.*[?&]id=([\w-]+)/) || v.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w600`;
  return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : ''; // only https links, never javascript:/data:
}
// Links for "View": uploaded files, Drive or other https links only.
const fileLink = (v) => {
  if (!v) return '';
  v = String(v);
  if (v.startsWith('file:')) return fileUrl(v);
  return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : '';
};

const initials = (m) => (m?.name_en || m?.name_kh || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Broken images: show the member's initials (data-i) or remove the image. One global listener
// instead of inline HTML event-handler attributes, so the Content-Security-Policy can forbid inline script.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.dataset.i !== undefined) img.parentNode.textContent = img.dataset.i;
  else if (img.dataset.rm !== undefined) img.remove();
}, true);

function photoHtml(m) {
  const url = fileUrl(m?.photo);
  const ini = esc(initials(m));
  return url
    ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-i="${ini}">`
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
  // Staff accounts without a member profile and without the Admin tab (moderators) get an "Account" tab;
  // admins manage their own password and sign-in email in Admin › System users (their "(you)" row).
  if (!u.member_id && !isAdmin()) tabs.push(['/account', 'Account', ICON.user]);
  tabbar.innerHTML = tabs.map(([href, label, icon]) =>
    `<a href="#${href}" class="${active === href ? 'on' : ''}">${icon}<span>${label}</span></a>`).join('');
  tabbar.hidden = false;
}

const header = (title, sub = '', back = '') => `
  <header class="top">
    ${back ? `<a class="icon-btn" href="#${back}" aria-label="Back">${ICON.back}</a>` : ''}
    <div style="flex:1;min-width:0"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <button class="icon-btn help-btn" data-tour aria-label="System tour / help" title="ណែនាំប្រព័ន្ធ · System tour">?</button>
    <button class="icon-btn" data-logout aria-label="Sign out" title="Sign out">${ICON.logout}</button>
  </header>`;

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-tour]') && state.user) startTour(tourKind(state.user, state.member));
});

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
const DEFAULT_LEVEL = { key: 'member', kh: 'សមាជិក', en: 'Member', color: '' };
const levels = () => state.settings?.levels || [DEFAULT_LEVEL];
const levelOf = (m) => levels().find((l) => l.key === (m?.level || 'member')) || DEFAULT_LEVEL;
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');

function passCard(m) {
  const s = statusOf(m);
  const active = s.key === 'ACTIVE';
  const lvl = levelOf(m);
  const color = safeColor(lvl.color);
  return `
  <section class="pass${active ? ' on' : ''}${color ? ' lvl' : ''}" ${color ? `style="--lvl:${color}"` : ''} aria-label="Membership pass">
    <div class="pass-head">
      <div class="pass-brand"><img class="pass-logo" src="${IMG('logo-card.png')}" alt="AISARC logo"><img class="pass-org" src="${IMG('name.png')}" alt="ស.គ.ឯ.ស.ប.ក AISARC"></div>
      <div class="pass-status"><div class="pass-label">Status</div><span class="pass-pill s-${s.color}">${esc(s.key)}</span>
        ${lvl.key !== 'member' ? `<div class="pass-level">${esc(lvl.kh)}<br>${esc(lvl.en)}</div>` : ''}</div>
    </div>
    <div class="pass-body">
      <div class="pass-info">
        <div><div class="pass-label">Name</div><div class="pass-val kh">${esc(m.name_kh || '—')}</div><div class="en">${esc(m.name_en || '')}</div></div>
        <div><div class="pass-label">Technical training</div><div class="pass-val small">${esc(m.training || '—')}</div></div>
        <div><div class="pass-label">Membership No.</div><div class="pass-val">${esc(m.member_no || '—')}</div></div>
      </div>
      <div class="pass-photo">${photoHtml(m)}</div>
    </div>
    <div class="pass-2col">
      <div><div class="pass-label">Birthday</div><div class="pass-val">${esc(m.dob || '—')}</div></div>
      <div><div class="pass-label">Member since</div><div class="pass-val">${esc(fmtDate(m.joined_at))}</div></div>
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
  if (s === 'DRAFT') {
    const left = missingForReview(m).length;
    return `<div class="notice grey"><h3>បំពេញព័ត៌មាន រួចដាក់ស្នើ · Complete your profile</h3>
    <p>Your application has not been submitted yet.${left ? ` <b>${left}</b> required item${left === 1 ? ' is' : 's are'} still missing.` : ' Everything is complete – submit it for review.'}</p>
    <div class="actions"><a class="btn sm" href="#/profile">Complete &amp; submit · បំពេញ និង ដាក់ស្នើ</a></div></div>`;
  }
  if (s === 'REVIEW') return `<div class="notice orange"><h3>កំពុងរង់ចាំការពិនិត្យ · Waiting for review</h3>
    <p>A moderator will review your information soon. Please make sure your profile is complete and correct.</p>
    <div class="actions"><a class="btn sm light" href="#/profile">Check my information</a></div></div>`;
  if (s === 'REJECTED') return `<div class="notice red"><h3>ពាក្យសុំត្រូវបានបដិសេធ · Application rejected</h3>
    ${reviewReason(m)}<p>Please update your information, then submit again.</p>
    <div class="actions"><a class="btn sm" href="#/profile">Fix &amp; resubmit · កែ និង ដាក់ស្នើម្ដងទៀត</a></div></div>`;
  if (s === 'PENDING') return `<div class="notice grey"><h3>សមាជិកភាពផុតកំណត់ · Membership expired</h3>
    <p>Your membership expired on <b>${esc(fmtDate(m.expires_at))}</b>. Please pay the membership fee (see Association) and request renewal.</p>
    <div class="actions"><a class="btn sm light" href="#/association">Payment info</a><button class="btn sm" data-submit>Request renewal</button></div></div>`;
  if (s === 'INACTIVE') return m.consent !== CONSENT_YES
    ? `<div class="notice red"><h3>អសកម្ម · Inactive</h3><p>You have not agreed to the declaration, so your membership is inactive and your information is not used.
       To re-activate, agree to the declaration in your profile.</p><div class="actions"><a class="btn sm light" href="#/profile">Go to my profile</a></div></div>`
    : `<div class="notice red"><h3>អសកម្ម · Inactive</h3><p>${m.inactive_reason === 'not_renewed'
        ? 'Your membership became inactive because it was not renewed for a long time. Please pay the membership fee (see Association) and ask for it to be reviewed again.'
        : 'Your membership is inactive. You can ask for it to be reviewed again.'}</p>
       <div class="actions">${m.inactive_reason === 'not_renewed' ? '<a class="btn sm light" href="#/association">Payment info</a>' : ''}<button class="btn sm" data-submit>Submit for review</button></div></div>`;
  return '';
}

function bindSubmit(root) {
  root.querySelectorAll('[data-submit]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      state.member = (await api('/api/me/submit', { body: {} })).member;
      toast('Submitted for review');
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
    ${privacyBanner()}
    <div class="card" style="margin-top:16px">
      <h2>${esc(m.name_kh || m.name_en)}</h2>
      <div style="color:var(--muted);font-size:14px">${esc(m.workplace || '')}${m.department ? ` · ${esc(m.department)}` : ''}</div>
      <div class="actions" style="margin-top:14px"><a class="btn block" href="#/profile">${ICON.user} ${m.lock?.locked ? 'My information · Request change' : 'Edit my information'}</a></div>
    </div>`;
  tickClocks();
  bindSubmit(app);
}

// ---------- member form ----------
// opts.edit: Set of field keys that are editable (overrides the role rules, used for locked profiles);
// opts.reqMode: file fields upload into a change request instead of the profile.
function fieldHtml(f, m, role, need = null, opts = {}) {
  const editable = opts.edit ? opts.edit.has(f.key) : canEdit(f, role);
  const v = m[f.key] ?? '';
  const dis = editable ? '' : 'disabled';
  const req = f.required || need?.required.has(f.key);
  const miss = need?.missing.has(f.key) ? ' miss' : '';
  const lbl = `<span class="lbl">${esc(f.kh)}${req ? ' <b class="req">*</b>' : ''}${editable || role === 'moderator' ? '' : ` <span class="lock" title="Managed by the admin">${ic('lock')}</span>`}<small>${esc(f.en)}</small></span>`;
  const name = `name="${f.key}" id="f_${f.key}"`;
  let input;
  if (f.type === 'photo' || f.type === 'file') {
    const url = fileUrl(v);
    const thumb = f.type === 'photo'
      ? (url ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" data-rm>` : 'No photo')
      : (v ? ic('file') : 'None');
    input = `<div class="upload"><div class="thumb">${thumb}</div><div class="actions">
      ${editable ? `<label class="btn sm light">Upload<input type="file" ${opts.reqMode ? 'data-req-upload' : 'data-upload'}="${f.key}" accept="${f.accept || 'image/*'}"></label>` : ''}
      ${fileLink(v) ? `<a class="btn sm light" href="${esc(fileLink(v))}" target="_blank" rel="noopener noreferrer">View</a>` : ''}</div></div>`;
    return `<div class="field${miss}" data-field="${f.key}">${lbl}${input}</div>`;
  }
  if (f.type === 'level') {
    const cur = v || 'member';
    input = `<select ${name} ${dis}>${levels().map((l) => `<option value="${esc(l.key)}" ${l.key === cur ? 'selected' : ''}>${esc(l.kh)} · ${esc(l.en)}</option>`).join('')}</select>`;
  } else if (f.type === 'datetime') {
    input = editable ? `<input type="datetime-local" ${name} value="${esc(toLocalInput(v))}">` : `<input value="${esc(fmtDateTime(v))}" data-icon="cal" disabled>`;
  } else if (f.type === 'select') {
    const choices = [...f.options];
    const old = v && !choices.includes(v);
    if (old) choices.unshift(v);
    const label = (o) => (old && o === v ? `${o} – please choose a province` : f.labels?.[o] || (f.key === 'status' && STATUS_MAP[o] ? `${o} · ${STATUS_MAP[o].en}` : o));
    input = `<select ${name} ${dis}><option value="">—</option>${choices.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(label(o))}</option>`).join('')}</select>`;
    // Free text entered before the province list existed (Google Form / earlier versions).
    const was = m.legacy_text?.[f.key];
    if (was && was !== v) input += `<small class="was">Originally entered: ${esc(was)}</small>`;
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
  return `<label class="field${miss}" for="f_${f.key}" data-field="${f.key}">${lbl}${input}</label>`;
}

// need: { required: Set, missing: Set } – used while a new member completes their profile.
function formHtml(m, role, need = null) {
  return SECTIONS.map((s) => {
    const fs = FIELDS.filter((f) => f.section === s.id);
    return `<section class="card"><h2>${esc(s.kh)} <small>${esc(s.en)}</small></h2>
      <div class="grid2">${fs.map((f) => fieldHtml(f, m, role, need)).join('')}</div></section>`;
  }).join('');
}

// Disabled inputs (locked fields) are never sent.
function collect(form, role, fields = FIELDS) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.key];
    if (!el || el.disabled || (role && !canEdit(f, role))) continue;
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
      toast('Uploaded');
      onDone(r.member);
    } catch (e) { toast(e.message, true); }
  }));
}

function viewProfile(showMissing = false) {
  const m = state.member;
  if (m.lock?.locked) return viewProfileLocked();
  const applicant = ['DRAFT', 'REJECTED'].includes(m.status);
  const need = applicant ? { required: new Set(SUBMIT_REQUIRED), missing: new Set(showMissing ? missingForReview(m) : []) } : null;
  const untilHint = !applicant && m.lock?.until
    ? `<div class="notice grey"><p style="margin:0">${ic('edit')} You can edit your information until <b>${esc(fmtDate(m.lock.until))}</b>.
       After that it is locked and changes are sent to the admin for approval. · អ្នកអាចកែប្រែព័ត៌មានបានរហូតដល់ ${esc(fmtDate(m.lock.until))}។</p></div>` : '';
  app.className = '';
  app.innerHTML = `${header('My Profile', 'ព័ត៌មានផ្ទាល់ខ្លួន · Edit your information')}
    ${m.status === 'ACTIVE' ? '' : memberNotice(m)}
    ${privacyBanner()}
    ${untilHint}
    ${applicant ? `<section class="card progress-card" id="progress"></section>` : ''}
    <form id="pf" novalidate>${formHtml(m, 'member', need)}
      <div class="sticky-save">${applicant
        ? `<div class="actions"><button class="btn light" type="submit" style="flex:1">រក្សាទុក · Save</button>
           <button class="btn" type="button" id="submitReview" style="flex:1.6">ដាក់ស្នើ · Submit</button></div>`
        : '<button class="btn block" type="submit">Save changes · រក្សាទុក</button>'}</div>
    </form>
    ${accountCard()}${myDataCard(m)}`;
  const form = $('#pf');
  bindMyData(() => viewProfile());
  // The status card already explains things here; buttons for applicants live in the bottom bar.
  app.querySelectorAll(`.notice a[href="#/profile"]${applicant ? ', .notice [data-submit]' : ''}`).forEach((a) => a.remove());
  bindSubmit(app);
  // After an upload only refresh that field, so anything typed but not yet saved is kept.
  const onUploaded = (mm) => {
    state.member = mm;
    form.querySelectorAll('[data-upload]').forEach((inp) => {
      const k = inp.dataset.upload;
      const wrap = form.querySelector(`[data-field="${k}"]`);
      const tmp = document.createElement('div');
      tmp.innerHTML = fieldHtml(FIELDS.find((f) => f.key === k), mm, 'member', need);
      wrap.replaceWith(tmp.firstElementChild);
    });
    bindUploads(form, null, onUploaded);
    renderProgress();
  };
  bindUploads(form, null, onUploaded);

  // Live completion progress for applicants.
  const current = () => ({ ...state.member, ...collect(form, 'member') });
  const renderProgress = () => {
    if (!applicant) return;
    const missing = missingForReview(current());
    const done = SUBMIT_REQUIRED.length - missing.length;
    const pct = Math.round((done / SUBMIT_REQUIRED.length) * 100);
    $('#progress').innerHTML = `
      <h2>${missing.length ? 'បំពេញព័ត៌មានឱ្យគ្រប់' : 'រួចរាល់ហើយ!'} <small>${missing.length ? 'Complete your profile to submit' : 'Ready to submit'}</small></h2>
      <div class="bar big"><i style="width:${pct}%"></i></div>
      <p class="hint" style="text-align:left;margin:8px 0">${done} / ${SUBMIT_REQUIRED.length} required items (<b class="req">*</b>) completed</p>
      ${missing.length ? `<div class="chips">${missing.map((k) => `<button type="button" class="mchip" data-goto="${k}">${esc(FIELDS.find((f) => f.key === k).kh)}</button>`).join('')}</div>` : ''}`;
    form.querySelectorAll('[data-field].miss').forEach((el) => { if (!missing.includes(el.dataset.field)) el.classList.remove('miss'); });
  };
  renderProgress();
  form.addEventListener('input', renderProgress);
  form.addEventListener('change', renderProgress);
  $('#progress')?.addEventListener('click', (e) => {
    const k = e.target.closest('[data-goto]')?.dataset.goto;
    if (!k) return;
    const el = form.querySelector(`[data-field="${k}"]`);
    el.classList.add('miss');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('input:not([type=file]),select,textarea')?.focus({ preventScroll: true });
  });

  const save = async () => {
    const data = collect(form, 'member');
    if (data.consent && data.consent !== CONSENT_YES && m.consent === CONSENT_YES
      && !confirm('If you do not agree to the declaration your membership will become INACTIVE. Continue?')) return null;
    const r = await api('/api/me', { method: 'PUT', body: data });
    state.member = r.member;
    return r.member;
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const before = m.status;
      const mm = await save();
      if (mm) { toast('Saved'); if (mm.status !== before) viewProfile(); }
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });
  $('#submitReview')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const mm = await save();
      if (!mm) return (btn.disabled = false);
      if (missingForReview(mm).length) {
        toast('Please complete the highlighted items · សូមបំពេញព័ត៌មានដែលបានសម្គាល់', true);
        viewProfile(true);
        const first = $('[data-field].miss');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!confirm('Submit your profile for review?\nដាក់ស្នើព័ត៌មានរបស់អ្នកដើម្បីពិនិត្យ?')) return (btn.disabled = false);
      state.member = (await api('/api/me/submit', { body: {} })).member;
      toast('Submitted for review · បានដាក់ស្នើ');
      go('/pass');
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
}

// ---------- locked profile: display only + per-section change requests ----------
const REQ_SECTIONS = ['personal', 'contact', 'work', 'reg'];
const fieldLabel = (k) => { const f = FIELDS.find((x) => x.key === k); return f ? `${f.kh} · ${f.en}` : k; };
const showVal = (k, v) => {
  if (v === '' || v == null) return '—';
  if (String(v).startsWith('file:')) return `<a href="${esc(fileUrl(v))}" target="_blank" rel="noopener noreferrer">${ic('clip')} file</a>`;
  const f = FIELDS.find((x) => x.key === k);
  return esc(f?.labels?.[v] || v) + (f?.unit ? ` ${esc(f.unit)}` : '');
};
function changeList(r) {
  return `<ul class="chg">${Object.keys(r.changes).map((k) => `<li><b>${esc(fieldLabel(k))}</b>: <s>${showVal(k, r.previous[k])}</s> ${ic('arrow')} ${showVal(k, r.changes[k])}</li>`).join('')}</ul>`;
}

async function viewProfileLocked(editing = null) {
  const m = state.member;
  if (!$('#pf')) app.innerHTML = skeleton('page', 3);
  let requests = [];
  try { requests = await api('/api/me/change-requests'); } catch (e) { toast(e.message, true); }
  const recent = (sec) => requests.find((r) => r.section === sec && !['replaced', 'cancelled'].includes(r.status));
  const pendingFiles = {};
  const editSet = (sec) => new Set(FIELDS.filter((f) => f.section === sec && canEdit(f, 'member')).map((f) => f.key));
  const days = state.settings?.edit_days;

  const sectionCard = (s) => {
    const fs = FIELDS.filter((f) => f.section === s.id);
    const isEditing = editing === s.id;
    const r = recent(s.id);
    const status = !r || isEditing ? ''
      : r.status === 'pending' ? `<div class="notice orange req-box"><b>${ic('hourglass')} Change requested · កំពុងរង់ចាំការពិនិត្យ</b> <small>${esc(fmtDateTime(r.created_at))}</small>${changeList(r)}
          ${r.note ? `<p class="pre">“${esc(r.note)}”</p>` : ''}<div class="actions"><button class="btn sm light" type="button" data-cancel-req="${r.id}">Cancel request</button></div></div>`
      : Date.now() - new Date(r.decided_at) < 30 * 864e5
        ? (r.status === 'approved'
          ? `<div class="notice green req-box"><b>${ic('check')} Change approved</b> <small>${esc(fmtDateTime(r.decided_at))}</small></div>`
          : `<div class="notice red req-box"><b>${ic('x')} Change rejected</b> <small>${esc(fmtDateTime(r.decided_at))}</small><p class="pre">${esc(r.reason || '')}</p></div>`)
        : '';
    const btn = REQ_SECTIONS.includes(s.id) && !isEditing && !editing
      ? `<button class="btn sm light" type="button" data-req-section="${s.id}">${ic('edit')} ${r?.status === 'pending' ? 'Update request' : 'Request change'} · ស្នើកែប្រែ</button>` : '';
    const opts = { edit: isEditing ? editSet(s.id) : new Set(s.id === 'membership' ? ['consent'] : []), reqMode: true };
    // Updating a pending request: start from the values already requested.
    const updating = isEditing && r?.status === 'pending';
    if (updating) Object.entries(r.changes).forEach(([k, v]) => { if (String(v).startsWith('file:')) pendingFiles[k] = v; });
    const src = updating ? { ...m, ...r.changes } : m;
    return `<section class="card ${isEditing ? 'editing' : ''}" data-section="${s.id}">
      <div class="sec-head"><h2>${esc(s.kh)} <small>${esc(s.en)}</small></h2>${btn}</div>
      ${status}
      <div class="grid2">${fs.map((f) => fieldHtml(f, src, 'member', null, opts)).join('')}</div>
      ${isEditing ? `<label class="field"><span class="lbl">Note to the admin<small>Optional – why the change is needed</small></span><textarea id="req-note" rows="2">${updating ? esc(r.note || '') : ''}</textarea></label>
        <div class="actions"><button class="btn" type="button" id="send-req">Send for review · ផ្ញើ</button><button class="btn light" type="button" id="cancel-edit">Cancel</button></div>` : ''}
      ${s.id === 'membership' && !editing ? '<div class="actions"><button class="btn sm" type="button" id="save-consent">Save declaration · រក្សាទុក</button></div>' : ''}
    </section>`;
  };

  app.className = '';
  app.innerHTML = `${header('My Profile', 'ព័ត៌មានផ្ទាល់ខ្លួន · Information locked')}
    ${m.status === 'ACTIVE' ? '' : memberNotice(m)}
    ${privacyBanner()}
    <div class="notice grey"><h3>${ic('lock')} ព័ត៌មានត្រូវបានចាក់សោ · Information locked</h3>
      <p>Your information was approved${days ? ` more than ${esc(days)} days ago` : ''} and can no longer be edited directly.
      To correct something, tap <b>Request change</b> on that section – an admin will review it.
      <br>ដើម្បីកែប្រែ សូមចុច «ស្នើកែប្រែ» នៅផ្នែកនោះ – អ្នកគ្រប់គ្រងនឹងពិនិត្យ។</p></div>
    <form id="pf" novalidate>${SECTIONS.map(sectionCard).join('')}</form>
    ${accountCard()}${myDataCard(m)}`;
  app.querySelectorAll('.notice a[href="#/profile"]').forEach((a) => a.remove());
  bindSubmit(app);
  bindMyData(() => viewProfile());
  const form = $('#pf');
  if (editing) form.querySelector(`[data-section="${editing}"]`).scrollIntoView({ block: 'start' });

  form.addEventListener('click', async (e) => {
    const sec = e.target.closest('[data-req-section]')?.dataset.reqSection;
    if (sec) return viewProfileLocked(sec);
    const cancelId = e.target.closest('[data-cancel-req]')?.dataset.cancelReq;
    if (cancelId && confirm('Cancel this change request?')) {
      try { await api(`/api/me/change-requests/${cancelId}`, { method: 'DELETE', body: {} }); toast('Request cancelled'); viewProfileLocked(); } catch (err) { toast(err.message, true); }
    }
  });
  $('#cancel-edit')?.addEventListener('click', () => viewProfileLocked());
  form.querySelectorAll('[data-req-upload]').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      toast('Uploading…');
      const r = await api('/api/me/request-file', { body: { field: inp.dataset.reqUpload, dataUrl: await readFile(file) } });
      pendingFiles[inp.dataset.reqUpload] = r.value;
      const thumb = inp.closest('.upload').querySelector('.thumb');
      thumb.innerHTML = file.type.startsWith('image/') ? `<img src="${esc(fileUrl(r.value))}" alt="">` : ic('file');
      toast('Attached – send the request to submit it');
    } catch (err) { toast(err.message, true); }
  }));
  $('#send-req')?.addEventListener('click', async (e) => {
    const changes = { ...collect(form, 'member', FIELDS.filter((f) => f.section === editing)), ...pendingFiles };
    e.target.disabled = true;
    try {
      await api('/api/me/change-requests', { body: { section: editing, changes, note: $('#req-note').value } });
      toast('Request sent for review · បានផ្ញើ');
      viewProfileLocked();
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
  $('#save-consent')?.addEventListener('click', async () => {
    const consent = form.elements.consent.value;
    if (consent !== CONSENT_YES && m.consent === CONSENT_YES
      && !confirm('If you do not agree to the declaration your membership will become INACTIVE. Continue?')) return;
    try {
      state.member = (await api('/api/me', { method: 'PUT', body: { consent } })).member;
      toast('Saved');
      viewProfile();
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- privacy ----------
const needsPrivacy = () => state.member && state.member.privacy_version !== PRIVACY_VERSION;

function privacyBanner() {
  if (!needsPrivacy()) return '';
  return `<div class="notice orange" id="privacy-banner"><h3>ឯកជនភាព · Privacy notice</h3>
    <p>សូមអានពីរបៀបដែលសមាគមប្រើប្រាស់ និង ការពារព័ត៌មានរបស់អ្នក។ Please read how the association uses and protects your personal data.</p>
    <div class="actions"><a class="btn sm light" href="#/privacy">Read · អាន</a><button class="btn sm" data-accept-privacy>I accept · ខ្ញុំយល់ព្រម</button></div></div>`;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-accept-privacy]');
  if (!b) return;
  b.disabled = true;
  try {
    state.member = (await api('/api/me/privacy', { body: { accept: true } })).member;
    toast('Thank you · អរគុណ');
    route();
  } catch (err) { toast(err.message, true); b.disabled = false; }
});

function viewPrivacy() {
  app.className = '';
  const signedIn = !!state.user;
  app.innerHTML = `${signedIn ? header('Privacy', 'ឯកជនភាព') : `<header class="top"><a class="icon-btn" href="#/login" aria-label="Back">${ICON.back}</a>
      <div style="flex:1"><h1>Privacy</h1><div class="sub">ឯកជនភាព</div></div></header>`}
    <section class="card privacy">
      <h2>សេចក្តីជូនដំណឹងអំពីឯកជនភាព <small>Privacy notice · version ${esc(PRIVACY_VERSION)}</small></h2>
      ${PRIVACY.map((s, i) => `<h3>${i + 1}. ${esc(s.kh)} · ${esc(s.en)}</h3><p class="kh">${esc(s.khBody)}</p><p class="en">${esc(s.enBody)}</p>`).join('')}
    </section>
    ${signedIn && needsPrivacy() ? '<button class="btn block" data-accept-privacy>I accept · ខ្ញុំយល់ព្រម</button>' : ''}
    ${signedIn && state.member ? '<a class="btn block light" href="#/profile" style="margin-top:10px">My data &amp; privacy · ទិន្នន័យរបស់ខ្ញុំ</a>' : ''}`;
}

// "My data & privacy" card on the profile: consent record, download, deletion request.
function myDataCard(m) {
  const consent = m.consent_at ? `${esc(m.consent === CONSENT_YES ? 'Agreed' : 'Not agreed')} · ${esc(fmtDateTime(m.consent_at))}` : esc(m.consent || '—');
  const accepted = m.privacy_accepted_at ? `version ${esc(m.privacy_version)} · ${esc(fmtDateTime(m.privacy_accepted_at))}` : 'not yet accepted';
  return `<section class="card" id="mydata"><h2>ទិន្នន័យរបស់ខ្ញុំ <small>My data &amp; privacy</small></h2>
    <dl class="kv"><dt>Declaration</dt><dd>${consent}</dd><dt>Privacy notice</dt><dd>${accepted}</dd></dl>
    <div class="actions" style="margin-top:12px">
      <a class="btn sm light" href="#/privacy">Privacy notice · ឯកជនភាព</a>
      <button class="btn sm light" type="button" id="dl-mydata">${ic('download')} Download my data</button>
    </div>
    ${m.deletion_requested_at
      ? `<div class="notice red" style="margin-bottom:0"><b>Deletion requested</b> on ${esc(fmtDateTime(m.deletion_requested_at))}. The association will delete your data within 30 days.
         <div class="actions"><button class="btn sm light" type="button" id="cancel-del">Cancel request</button></div></div>`
      : `<details class="danger"><summary>Request deletion of my data · ស្នើសុំលុបទិន្នន័យ</summary>
         <p>Your membership and all your personal data will be deleted by the association within 30 days. This cannot be undone.</p>
         <textarea id="del-reason" rows="2" placeholder="Reason (optional)"></textarea>
         <div class="actions" style="margin-top:8px"><button class="btn danger" type="button" id="req-del">Request deletion</button></div></details>`}
  </section>`;
}

function bindMyData(rerender) {
  $('#dl-mydata')?.addEventListener('click', async () => {
    try {
      const r = await fetch('/api/me/export', { credentials: 'same-origin' });
      if (!r.ok) throw new Error('Download failed');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: 'my-aisarc-data.json' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { toast(e.message, true); }
  });
  $('#req-del')?.addEventListener('click', async () => {
    if (!confirm('Request deletion of your membership and all your data?\nស្នើសុំលុបសមាជិកភាព និង ទិន្នន័យទាំងអស់?')) return;
    try { state.member = (await api('/api/me/deletion', { body: { reason: $('#del-reason').value } })).member; toast('Request sent'); rerender(); } catch (e) { toast(e.message, true); }
  });
  $('#cancel-del')?.addEventListener('click', async () => {
    try { state.member = (await api('/api/me/deletion', { method: 'DELETE', body: {} })).member; toast('Request cancelled'); rerender(); } catch (e) { toast(e.message, true); }
  });
}

// ---------- password ----------
// "My account" card: who is signed in, how, and the password / switch / sign-out buttons.
const accountHome = () => (state.user?.member_id ? '/profile' : isAdmin() ? '/system' : '/account');
function accountCard() {
  const u = state.user;
  const [kh, en] = ROLE_TEXT[u.role] || [u.role, u.role];
  return `<section class="card" id="account"><h2>គណនីរបស់ខ្ញុំ <small>My account &amp; sign-in</small></h2>
    <dl class="kv">
      <dt>Username</dt><dd>${esc(u.username)}</dd>
      ${u.email && u.email !== u.username ? `<dt>Sign-in email</dt><dd>${esc(u.email)}</dd>` : ''}
      <dt>Role</dt><dd>${esc(kh)} · ${esc(en)}</dd>
    </dl>
    ${u.email && state.config?.googleClientId ? `<p class="hint" style="text-align:left">You can also sign in with Google using <b>${esc(u.email)}</b>.</p>` : ''}
    ${u.other_accounts ? `<p class="hint" style="text-align:left">This email also opens ${u.other_accounts} other account${u.other_accounts === 1 ? '' : 's'}. Use <b>Switch account</b> to sign in to ${u.other_accounts === 1 ? 'it' : 'one of them'}.</p>` : ''}
    <div class="actions">
      <a class="btn light" href="#/password">${ICON.key} Change password · ប្ដូរពាក្យសម្ងាត់</a>
      ${u.other_accounts ? `<button class="btn light" type="button" data-switch>${ICON.users} Switch account</button>` : ''}
      <button class="btn light" type="button" data-logout>${ICON.logout} Sign out</button>
    </div>
  </section>`;
}
// Switching = sign out, then sign in again and pick the other account.
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-switch]')) return;
  await api('/api/logout', { body: {} }).catch(() => {});
  state.user = null;
  state.member = null;
  toast('Sign in again and choose the account');
  go('/login');
});

function viewAccount() {
  app.className = '';
  app.innerHTML = `${header('My account', 'គណនីរបស់ខ្ញុំ')}${accountCard()}`;
}

function viewPassword() {
  const must = state.user.must_change;
  app.className = '';
  app.innerHTML = `${header('Password', 'ពាក្យសម្ងាត់', must ? '' : accountHome())}
    <form class="card" id="pw">
      ${must ? '<p style="margin-top:0;color:#b45309">Please set a new password before continuing.<br>សូមកំណត់ពាក្យសម្ងាត់ថ្មី។</p>' : ''}
      <div class="field"><span class="lbl">Username</span><input value="${esc(state.user.username)}" data-icon="user" disabled></div>
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
      toast('Password updated');
      go(must ? home() : accountHome());
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- association info ----------
async function viewAssociation(edit = false) {
  app.className = '';
  app.innerHTML = skeleton('page', 3);
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
        toast('QR uploaded');
        viewAssociation(true);
      } catch (err) { toast(err.message, true); }
    });
    $('#asf').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/association', { method: 'PUT', body: collect(e.target, null, ASSOC_FIELDS) });
        toast('Saved');
        go('/association');
      } catch (err) { toast(err.message, true); }
    });
    return;
  }
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  const qr = fileUrl(a.qr);
  const term = parseInt(a.term_months, 10);
  const st = state.settings || {};
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const renewal = st.renewal_enabled && /^\d{2}-\d{2}$/.test(st.renewal_date || '')
    ? `Renew every year by <b>${+st.renewal_date.slice(3)} ${MON[+st.renewal_date.slice(0, 2) - 1]}</b> · បន្តរៀងរាល់ឆ្នាំ` : '';
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
        ${row('Validity', renewal || (term ? `${term} ខែ · months` : 'No expiry'))}
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
  $('#copyacc')?.addEventListener('click', () => navigator.clipboard?.writeText(a.account_no.replace(/\s/g, '')).then(() => toast('Copied')));
}

// ---------- members list (admin + moderator) ----------
// The server sends one page at a time (10 / 20 / 50 rows); search, filters and paging each make a new request.
const LIST_SIZES = [10, 20, 50];
let searchTimer;
async function viewAdmin() {
  app.className = 'wide';
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let filter = params.get('s') || (isAdmin() ? 'ALL' : 'REVIEW');
  let page = Math.max(1, parseInt(params.get('p'), 10) || 1);
  const savedSize = Number(localStorage.getItem('aisarc_list_size'));
  let size = LIST_SIZES.includes(Number(params.get('n'))) ? Number(params.get('n')) : LIST_SIZES.includes(savedSize) ? savedSize : 10;
  let selecting = false;
  const selected = new Set();
  let data = null;
  let seq = 0;
  app.innerHTML = `${header(isAdmin() ? 'Members' : 'Review', isAdmin() ? 'សមាជិក · Admin' : 'ពិនិត្យសមាជិក · Moderator')}
    <div class="search">${ICON.search}<input id="q" type="search" placeholder="Search name, phone, email, workplace, no…" value="${esc(params.get('q') || '')}" autocomplete="off"></div>
    <div class="filters" id="filters">${skRep(6, () => '<span class="sk sk-pill"></span>')}</div>
    <div class="toolbar" id="toolbar"></div>
    <div class="list" id="list">${skeleton('rows', size)}</div>
    <div class="pager" id="pager"></div>`;
  const term = () => $('#q').value.trim();
  const updateUrl = () => {
    const p = new URLSearchParams();
    if (term()) p.set('q', term());
    p.set('s', filter);
    if (page > 1) p.set('p', page);
    if (size !== 10) p.set('n', size);
    const h = `/admin?${p}`;
    history.replaceState(null, '', `#${h}`);
    sessionStorage.setItem('adminList', h);
  };
  const renderFilters = () => {
    const c = data.counts;
    const chips = [['ALL', 'All'], ...STATUSES.map((st) => [st.key, st.key[0] + st.key.slice(1).toLowerCase()]),
      ['DUP', 'Duplicate', 'alert'], ...(isAdmin() ? [['CHG', 'Change requests', 'edit']] : []),
      ...levels().filter((l) => l.key !== 'member').map((l) => [`L:${l.key}`, l.en])];
    $('#filters').innerHTML = chips
      .filter(([k]) => !k.startsWith('L:') || c[k] || k === filter)
      .map(([k, l, icon]) => `<button type="button" data-f="${esc(k)}" class="${filter === k ? 'on' : ''}${k === 'DUP' || k === 'CHG' ? ' warn' : ''}">${icon ? ic(icon) : ''}${esc(l)}<b>${c[k] || 0}</b></button>`).join('');
  };
  const renderToolbar = () => {
    const rows = data?.rows || [];
    const count = `<span class="count">${selecting ? `${selected.size} selected` : `${data ? data.total : '…'} member${data?.total === 1 ? '' : 's'}`}</span>`;
    if (!isAdmin()) return ($('#toolbar').innerHTML = count);
    $('#toolbar').innerHTML = selecting
      ? `${count}<button class="btn sm light" data-act="all">${rows.length && rows.every((m) => selected.has(m.id)) ? 'Clear page' : 'Select page'}</button>
         <button class="btn sm" data-act="export-sel" ${selected.size ? '' : 'disabled'}>${ic('download')} Export selected</button>
         <button class="btn sm light" data-act="cancel">Cancel</button>`
      : `${count}<a class="btn sm" href="#/admin/new">+ Add</a>
         <button class="btn sm light" data-act="select">Select</button>
         <button class="btn sm light" data-act="export" ${data?.total ? '' : 'disabled'}>${ic('download')} Export</button>`;
  };
  const renderList = () => {
    $('#list').innerHTML = data.rows.length ? data.rows.map((m) => `
      <a class="mrow${selecting && selected.has(m.id) ? ' sel' : ''}" href="#/admin/m/${m.id}" data-id="${m.id}">
        ${selecting ? `<input type="checkbox" class="pick" tabindex="-1" ${selected.has(m.id) ? 'checked' : ''} aria-label="Select">` : ''}
        <div class="avatar">${photoHtml(m)}</div>
        <div class="info"><div class="n1">${esc(m.name_kh)} · ${esc(m.name_en)}</div>
          <div class="n2">${esc(m.member_no || 'New applicant')} · ${esc(m.phone || m.email || '')}</div>
          <div class="n2">${esc(m.workplace || '')}</div>
          ${m.dups?.length || m.pending_changes ? `<div class="flags">${m.dups?.length ? `<span class="flag dup">${ic('alert')} Possible duplicate of ${esc(m.dups.map((d) => d.member_no || d.name_en).join(', '))}</span>` : ''}
            ${m.pending_changes ? `<span class="flag chg">${ic('edit')} Change request</span>` : ''}</div>` : ''}</div>
        ${chip(m)}
      </a>`).join('') : '<div class="empty">No members found</div>';
  };
  const renderPager = () => {
    const from = data.total ? (data.page - 1) * data.size + 1 : 0;
    const to = Math.min(data.total, data.page * data.size);
    $('#pager').innerHTML = `
      <label class="pg-size">Show <select id="psize" aria-label="Members per page">${LIST_SIZES.map((n) => `<option ${n === size ? 'selected' : ''}>${n}</option>`).join('')}</select> per page</label>
      <span class="pg-range">${from}–${to} of ${data.total}</span>
      <div class="pg-nav">
        <button type="button" class="btn sm light" data-pg="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''} aria-label="Previous page">${ic('prev')}</button>
        <span class="pg-num">Page ${data.page} / ${data.pages}</span>
        <button type="button" class="btn sm light" data-pg="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''} aria-label="Next page">${ic('next')}</button>
      </div>`;
  };
  const render = () => { renderFilters(); renderList(); renderToolbar(); renderPager(); };
  const load = async ({ scroll = false } = {}) => {
    const my = ++seq;
    // Keep the chips; show the skeleton only where the rows will appear.
    $('#list').innerHTML = skeleton('rows', Math.min(size, data?.rows.length || size));
    if (scroll) $('#filters').scrollIntoView({ block: 'nearest' });
    const p = new URLSearchParams({ s: filter, page, size });
    if (term()) p.set('q', term());
    try {
      const r = await api(`/api/members?${p}`);
      if (my !== seq || !$('#list')) return; // a newer request replaced this one
      data = r;
      page = r.page;
      updateUrl();
      render();
    } catch (e) { if (my === seq) { toast(e.message, true); $('#list').innerHTML = '<div class="empty">Could not load members</div>'; } }
  };
  renderToolbar();
  load();

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b || b.dataset.f === filter) return;
    filter = b.dataset.f;
    page = 1;
    $('#filters').querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
    load();
  });
  $('#q').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 1; load(); }, 300);
  });
  $('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]');
    if (!b || b.disabled) return;
    page = Number(b.dataset.pg);
    load({ scroll: true });
  });
  $('#pager').addEventListener('change', (e) => {
    if (e.target.id !== 'psize') return;
    size = Number(e.target.value);
    try { localStorage.setItem('aisarc_list_size', size); } catch { /* private mode */ }
    page = 1;
    load();
  });
  // In select mode, tapping a row toggles it instead of opening the member. The selection is kept across pages.
  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('.mrow');
    if (!row || !selecting) return;
    e.preventDefault();
    const id = Number(row.dataset.id);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    renderList();
    renderToolbar();
  });
  const exportWarn = 'The Excel file contains personal data. Keep it only as long as needed, store it securely and never share it publicly. Every export is recorded in the audit log.';
  $('#toolbar').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !data) return;
    if (act === 'select') { selecting = true; renderList(); renderToolbar(); }
    if (act === 'cancel') { selecting = false; selected.clear(); renderList(); renderToolbar(); }
    if (act === 'all') {
      const all = data.rows.every((m) => selected.has(m.id));
      data.rows.forEach((m) => (all ? selected.delete(m.id) : selected.add(m.id)));
      renderList();
      renderToolbar();
    }
    if (act === 'export-sel' && selected.size && confirm(`${exportWarn}\n\nExport ${selected.size} selected member(s)?`)) {
      location.href = `/api/export.xlsx?ids=${[...selected].join(',')}`;
    }
    if (act === 'export') {
      const d = modal(`<h3 style="margin-top:0">Export to Excel · នាំចេញ</h3>
        <p class="hint" style="text-align:left">${esc(exportWarn)}</p>
        <div class="export-opts">
          <button type="button" class="btn block light" data-x="page" ${data.rows.length ? '' : 'disabled'}>${ic('file')}<span>Current page<small>${data.rows.length} member${data.rows.length === 1 ? '' : 's'} shown on this page</small></span></button>
          <button type="button" class="btn block" data-x="all">${ic('download')}<span>All matching<small>${data.total} member${data.total === 1 ? '' : 's'} – current search and filter, all pages</small></span></button>
        </div>
        <div class="actions" style="justify-content:flex-end"><button type="button" class="btn light" data-close>Cancel</button></div>`);
      d.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close]')) return d.close();
        const x = ev.target.closest('[data-x]')?.dataset.x;
        if (!x) return;
        const p = new URLSearchParams();
        if (x === 'page') p.set('ids', data.rows.map((m) => m.id).join(','));
        else { p.set('s', filter); if (term()) p.set('q', term()); }
        d.close();
        location.href = `/api/export.xlsx?${p}`;
      });
    }
  });
}

// Audit log entries (actions on personal data) in readable form.
const AUDIT_LABEL = {
  'login': 'Signed in', 'login.google': 'Signed in with Google', 'login.failed': 'Failed sign-in', 'logout': 'Signed out',
  'register': 'Registered', 'member.view': 'Viewed record', 'member.self_update': 'Member edited own data', 'member.update': 'Staff edited record',
  'member.create': 'Record created', 'member.delete': 'Record deleted', 'member.submit': 'Submitted for review', 'member.approve': 'Approved',
  'member.reject': 'Rejected', 'member.activate': 'Activated', 'member.deactivate': 'Deactivated', 'consent.change': 'Consent changed',
  'privacy.accept': 'Accepted privacy notice', 'data.export_own': 'Downloaded own data', 'deletion.request': 'Requested deletion',
  'deletion.cancel': 'Cancelled deletion request', 'members.export': 'Excel export', 'backup.download': 'Backup downloaded',
  'backup.restore': 'Backup restored', 'role.change': 'Role changed', 'password.reset': 'Password reset by admin',
  'password.change': 'Password changed', 'user.create': 'System user created', 'user.delete': 'System user deleted', 'user.email': 'Sign-in email changed', 'user.rename': 'Username changed',
  'file.upload': 'File uploaded', 'file.view': 'Document viewed', 'association.update': 'Association info edited',
  'event.create': 'Event created', 'event.update': 'Event edited', 'event.delete': 'Event deleted', 'retention.purge': 'Retention clean-up',
  'event.join': 'Joined event', 'event.leave': 'Left event', 'event.bill_upload': 'Payment proof uploaded', 'event.export': 'Joiner list exported',
  'change.request': 'Change requested', 'change.cancel': 'Change request cancelled', 'change.approve': 'Change approved', 'change.reject': 'Change rejected',
  'member.not_duplicate': 'Marked “not a duplicate”', 'member.auto_inactive': 'Auto-inactive (not renewed)', 'settings.update': 'Settings changed',
};
function auditRow(r) {
  let detail = '';
  try {
    const d = r.detail ? JSON.parse(r.detail) : null;
    if (d && typeof d === 'object') detail = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
    else detail = r.detail || '';
  } catch { detail = r.detail || ''; }
  return `<div class="arow ${r.action === 'login.failed' ? 'warn' : ''}">
    <div class="a1"><b>${esc(AUDIT_LABEL[r.action] || r.action)}</b><span>${esc(fmtDateTime(r.at))}</span></div>
    <div class="a2">${esc(r.actor || '—')}${r.target ? ` ${ic('arrow')} ${esc(r.target)}` : ''}${r.ip ? ` · ${esc(r.ip)}` : ''}</div>
    ${detail ? `<div class="a2">${esc(detail)}</div>` : ''}</div>`;
}

// Status info for moderators/admins on the member page.
function staffNotice(m) {
  const del = m.deletion_requested_at
    ? `<div class="notice red"><h3>${ic('alert')} Deletion requested</h3><p>The member asked for their data to be deleted on <b>${esc(fmtDateTime(m.deletion_requested_at))}</b>${m.deletion_reason ? ` – “${esc(m.deletion_reason)}”` : ''}. Please delete the record (Danger zone) within 30 days.</p></div>` : '';
  const dup = m.dups?.length
    ? `<div class="notice orange"><h3>${ic('alert')} Possible duplicate · អាចស្ទួន</h3>
      ${m.duplicate_email ? `<p>Imported a second time with the same email <b>${esc(m.duplicate_email)}</b> (no login was created for this copy).</p>` : ''}
      <ul class="chg">${m.dups.map((d) => `<li><a href="#/admin/m/${d.id}">${esc(d.member_no || 'New applicant')} · ${esc(d.name_kh)} · ${esc(d.name_en)}</a> – ${esc(d.reasons.join(', '))}</li>`).join('')}</ul>
      <p>Compare the records. Delete the duplicate (Danger zone), or mark it as a different person.</p>
      ${isAdmin() ? '<div class="actions"><button class="btn sm light" type="button" id="not-dup">Not a duplicate · មិនស្ទួន</button></div>' : ''}</div>` : '';
  return del + dup + statusNotice(m);
}
function statusNotice(m) {
  const s = statusOf(m);
  const by = m.review?.by ? ` by <b>${esc(m.review.by)}</b> · ${esc(fmtDateTime(m.review.at))}` : '';
  if (s.key === 'REVIEW') return `<div class="notice orange"><h3>Waiting for review</h3><p>${m.applied_at ? `Submitted ${esc(fmtDateTime(m.applied_at))}. ` : ''}Check the information and documents, then approve or reject.</p></div>`;
  if (s.key === 'REJECTED') return `<div class="notice red"><h3>Rejected</h3>${reviewReason(m)}<p>${by}</p></div>`;
  if (s.key === 'PENDING') return `<div class="notice grey"><h3>Expired</h3><p>Membership expired on ${esc(fmtDate(m.expires_at))}. Waiting for the member to renew.</p></div>`;
  if (s.key === 'INACTIVE') return `<div class="notice red"><h3>Inactive</h3><p>${m.consent !== CONSENT_YES ? 'Member did not agree to the declaration.'
    : m.inactive_reason === 'not_renewed' ? `Automatically set inactive on ${esc(fmtDate(m.inactive_at))}: the membership was not renewed for ${esc(state.settings?.inactive_years || '')} year(s).` : 'Deactivated.'}</p></div>`;
  return `<div class="notice green"><h3>Active</h3><p>Valid until ${m.expires_at ? esc(fmtDate(m.expires_at)) : 'no expiry'}.${m.review?.decision === 'approved' ? ` Approved${by}` : ''}</p></div>`;
}

// Change requests (admin review). withMember: show who asked (used in the Admin tab list).
function changeRequestHtml(r, withMember = false) {
  const sec = SECTIONS.find((s) => s.id === r.section);
  return `<div class="creq" data-req="${r.id}">
    <div class="a1"><b>${withMember ? `<a href="#/admin/m/${r.member_id}">${esc(r.member_no || '')} · ${esc(r.name_kh || '')} · ${esc(r.name_en || '')}</a><br>` : ''}
      ${esc(sec?.en || r.section)} · ${esc(sec?.kh || '')}</b><span>${esc(fmtDateTime(r.created_at))}</span></div>
    ${changeList(r)}
    ${r.note ? `<p class="pre note">“${esc(r.note)}”</p>` : ''}
    ${r.status === 'pending'
      ? `<div class="actions"><button class="btn sm" style="background:var(--ok)" data-decide="approve">${ic('check')} Approve</button><button class="btn sm danger" data-decide="reject">${ic('x')} Reject</button></div>`
      : `<p class="hint" style="text-align:left;margin:4px 0 0">${esc(r.status)} by ${esc(r.decided_by || '')} · ${esc(fmtDateTime(r.decided_at))}${r.reason ? ` – ${esc(r.reason)}` : ''}</p>`}
  </div>`;
}
function bindChangeDecisions(root, onDone) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-decide]');
    if (!b) return;
    const id = b.closest('[data-req]').dataset.req;
    const decision = b.dataset.decide;
    let reason = '';
    if (decision === 'reject') {
      reason = prompt('Reason for rejecting (the member will see it):') || '';
      if (!reason.trim()) return;
    } else if (!confirm('Apply these changes to the member’s record?')) return;
    try {
      await api(`/api/change-requests/${id}/decision`, { body: { decision, reason } });
      toast(decision === 'approve' ? 'Change applied' : 'Change rejected');
      onDone();
    } catch (err) { toast(err.message, true); }
  });
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
    app.innerHTML = skeleton('member');
    try { m = await api(`/api/members/${id}`); } catch (e) { toast(e.message, true); return go('/admin'); }
  }
  const back = sessionStorage.getItem('adminList') || '/admin';
  const role = admin ? 'admin' : 'moderator';
  const s = m.status;
  const reviewBtns = s === 'REVIEW' || (admin && ['REJECTED'].includes(s))
    ? `<button class="btn sm" id="approve" style="background:var(--ok)">${ic('check')} Approve</button><button class="btn sm danger" id="reject">${ic('x')} Reject</button>` : '';
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
        ${admin && !isNew ? `<section class="card" id="mreqs" hidden><h2>${ic('edit')} Change requests <small>Submitted by the member</small></h2><div id="mreqbody"></div></section>` : ''}
        ${admin && !isNew ? `<details class="card history" id="history"><summary><b>Record history</b> <small>Who viewed or changed this record</small></summary><div id="histbody">${skeleton('lines', 3)}</div></details>
        <details class="danger"><summary>Danger zone · លុបសមាជិក</summary>
          <p>Deleting removes this member, their login and uploaded files permanently. To confirm, type <b>${esc(m.member_no || m.email)}</b> below.</p>
          <div class="actions"><input id="delconfirm" autocomplete="off" style="flex:1;min-width:160px"><button class="btn danger" id="del" disabled>Delete permanently</button></div>
        </details>` : ''}
      </div>
    </div>`;
  tickClocks();
  // Record history: requested only when opened, 30 entries at a time.
  let histLast = null;
  const loadHistory = async () => {
    const more = $('#histmore');
    if (more) more.disabled = true;
    try {
      const rows = await api(`/api/members/${id}/audit?limit=30${histLast ? `&before=${histLast}` : ''}`);
      const html = rows.map(auditRow).join('');
      if (!histLast) $('#histbody').innerHTML = rows.length ? `<div class="audit">${html}</div>` : '<p class="hint">No entries yet</p>';
      else $('#histbody .audit').insertAdjacentHTML('beforeend', html);
      if (rows.length) histLast = rows[rows.length - 1].id;
      $('#histmore')?.remove();
      if (rows.length === 30) $('#histbody').insertAdjacentHTML('beforeend', `<button class="btn sm light" type="button" id="histmore" style="margin-top:8px">${ic('next')} Load older entries</button>`);
    } catch (e) { $('#histbody').textContent = e.message; }
  };
  $('#history')?.addEventListener('toggle', (ev) => {
    if (!ev.target.open || ev.target.dataset.loaded) return;
    ev.target.dataset.loaded = '1';
    loadHistory();
  });
  $('#history')?.addEventListener('click', (ev) => { if (ev.target.closest('#histmore')) loadHistory(); });
  const reload = () => viewAdminEdit(id);
  if (admin && !isNew) {
    api(`/api/change-requests?member=${id}&status=all`).then((rows) => {
      const open = rows.filter((r) => r.status === 'pending');
      const shownRows = open.length ? open : rows.filter((r) => ['approved', 'rejected'].includes(r.status)).slice(0, 3);
      if (!shownRows.length || !$('#mreqs')) return;
      $('#mreqs').hidden = false;
      $('#mreqbody').innerHTML = shownRows.map((r) => changeRequestHtml(r)).join('');
      if (open.length) $('#mreqs').scrollIntoView({ block: 'nearest' });
    }).catch(() => {});
    bindChangeDecisions($('#mreqs'), reload);
  }
  $('#not-dup')?.addEventListener('click', async () => {
    if (!confirm('These records are different people? The warning will be hidden for these pairs.')) return;
    try { await api(`/api/members/${id}/not-duplicate`, { body: {} }); toast('Marked as not a duplicate'); reload(); } catch (err) { toast(err.message, true); }
  });
  if (isNew) app.querySelectorAll('[data-upload]').forEach((el) => el.closest('label').replaceWith('Save first, then upload'));
  const form = $('#af');
  if (admin) bindUploads(form, m.id, reload);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api(isNew ? '/api/members' : `/api/members/${id}`, { method: isNew ? 'POST' : 'PUT', body: collect(form, 'admin') });
      toast('Saved');
      isNew ? go(`/admin/m/${r.id}`) : reload();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  $('#approve')?.addEventListener('click', async () => {
    if (!confirm(`Approve ${m.name_en || 'this member'}? They will become ACTIVE.`)) return;
    try { await api(`/api/members/${id}/review`, { body: { decision: 'approve' } }); toast('Approved'); reload(); } catch (err) { toast(err.message, true); }
  });
  $('#reject')?.addEventListener('click', () => rejectDialog(id, reload));
  const setStatus = async (status) => {
    try { await api(`/api/members/${id}/status`, { body: { status } }); toast(`Now ${status}`); reload(); } catch (err) { toast(err.message, true); }
  };
  $('#activate')?.addEventListener('click', () => setStatus('ACTIVE'));
  $('#deactivate')?.addEventListener('click', () => confirm('Deactivate this member?') && setStatus('INACTIVE'));
  $('#role')?.addEventListener('change', async (e) => {
    try { await api(`/api/members/${id}/role`, { method: 'PUT', body: { role: e.target.value } }); toast('Role updated'); } catch (err) { toast(err.message, true); }
  });
  $('#reset')?.addEventListener('click', async () => {
    if (!confirm('Generate a new temporary password for this member?')) return;
    try {
      const r = await api(`/api/members/${id}/password`, { body: {} });
      const d = modal(`<h3 style="margin-top:0">Temporary password</h3><p>Share it privately with the member. It expires in 72 hours and must be changed at first sign-in.</p>
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
// Admin settings: profile edit window, annual renewal, auto-inactive, member levels.
async function loadSettingsForm(el) {
  // Fresh element each load so event listeners never stack up.
  const form = el.cloneNode(false);
  el.replaceWith(form);
  let s;
  try { s = await api('/api/settings'); } catch (e) { form.innerHTML = `<p class="hint">${esc(e.message)}</p>`; return; }
  const [mm, dd] = (s.renewal_date || '01-01').split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const levelRow = (l) => `<div class="lvl-row" data-key="${esc(l.key || '')}">
      <span class="lvl-dot" style="--lvl:${safeColor(l.color) || '#2a74c9'}"></span>
      <input name="en" value="${esc(l.en || '')}" placeholder="English" aria-label="English name" required>
      <input name="kh" value="${esc(l.kh || '')}" placeholder="ខ្មែរ" aria-label="Khmer name" required>
      <label class="lvl-color" title="Card colour"><input type="checkbox" name="custom" ${l.color ? 'checked' : ''}> <input type="color" name="color" value="${safeColor(l.color) || '#2a74c9'}" ${l.color ? '' : 'disabled'}></label>
      ${l.key === 'member' ? '<span class="lvl-fixed" title="Default level">default</span>' : `<button type="button" class="icon-btn" data-rm title="Remove level">${ic('x')}</button>`}
    </div>`;
  form.innerHTML = `<h2>Settings <small>ការកំណត់</small></h2>
    <h3 class="sub">${ic('edit')} Profile editing · ការកែប្រែព័ត៌មាន</h3>
    <label class="field"><span class="lbl">Members can edit their information for<small>Days after approval. After that the profile is locked (display only) and members send a change request per section for an admin to approve. Leave empty for no limit.</small></span>
      <div class="unit" style="max-width:260px"><input name="edit_days" inputmode="numeric" pattern="\\d*" value="${esc(s.edit_days ?? '')}" placeholder="no limit"><span>days · ថ្ងៃ</span></div></label>
    <h3 class="sub">${ic('refresh')} Annual renewal · ការបន្តប្រចាំឆ្នាំ</h3>
    <label class="check"><input type="checkbox" name="renewal_enabled" ${s.renewal_enabled ? 'checked' : ''}><span>Every year on this date, members who have not renewed become <b>PENDING</b> · បន្តសមាជិកភាពប្រចាំឆ្នាំ</span></label>
    <div class="grid2 indent two" data-dep="renewal_enabled">
      <label class="field"><span class="lbl">Month</span><select name="mm">${MONTHS.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${+mm === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Day</span><select name="dd">${Array.from({ length: 31 }, (_, i) => `<option ${+dd === i + 1 ? 'selected' : ''}>${String(i + 1).padStart(2, '0')}</option>`).join('')}</select></label>
    </div>
    <p class="hint indent" data-dep="renewal_enabled" style="text-align:left;margin-top:0">Members approved or renewed within 60 days before the date stay active until the following year.</p>
    <label class="check"><input type="checkbox" name="inactive_enabled" ${s.inactive_enabled ? 'checked' : ''}><span>Automatically set <b>INACTIVE</b> when a member stays PENDING for · អសកម្មដោយស្វ័យប្រវត្តិ</span></label>
    <div class="indent" data-dep="inactive_enabled"><div class="unit" style="max-width:260px"><input name="inactive_years" inputmode="numeric" value="${esc(s.inactive_years || '2')}"><span>years · ឆ្នាំ</span></div></div>
    <h3 class="sub">${ic('star')} Member levels · កម្រិតសមាជិក</h3>
    <p class="hint" style="text-align:left;margin-top:0">Shown on the member card. Tick the colour box to give a level its own card colour (otherwise the logo blue is used).</p>
    <div id="lvls">${s.levels.map(levelRow).join('')}</div>
    <button type="button" class="btn sm light" id="addlvl">+ Add level</button>
    <button class="btn block" type="submit" style="margin-top:14px">Save settings</button>`;
  const deps = () => form.querySelectorAll('[data-dep]').forEach((el) => {
    const on = form.elements[el.dataset.dep].checked;
    el.classList.toggle('off', !on);
    el.querySelectorAll('input,select').forEach((i) => (i.disabled = !on));
  });
  deps();
  form.addEventListener('change', (e) => {
    if (e.target.name === 'custom') {
      const row = e.target.closest('.lvl-row');
      row.querySelector('[name=color]').disabled = !e.target.checked;
    }
    if (e.target.name === 'color') e.target.closest('.lvl-row').querySelector('.lvl-dot').style.setProperty('--lvl', e.target.value);
    deps();
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-rm]')) {
      const row = e.target.closest('.lvl-row');
      if (confirm('Remove this level? Members on it go back to the default level when you save.')) row.remove();
    }
    if (e.target.id === 'addlvl') {
      $('#lvls').insertAdjacentHTML('beforeend', levelRow({ key: '', kh: '', en: '', color: '#0f766e' }));
      $('#lvls').lastElementChild.querySelector('[name=en]').focus();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const body = {
      edit_days: f.edit_days.value.trim(),
      renewal_enabled: f.renewal_enabled.checked,
      inactive_enabled: f.inactive_enabled.checked,
      levels: [...form.querySelectorAll('.lvl-row')].map((r) => ({
        key: r.dataset.key, kh: r.querySelector('[name=kh]').value, en: r.querySelector('[name=en]').value,
        color: r.querySelector('[name=custom]').checked ? r.querySelector('[name=color]').value : '',
      })),
    };
    if (body.renewal_enabled) body.renewal_date = `${f.mm.value}-${f.dd.value}`;
    if (body.inactive_enabled) body.inactive_years = f.inactive_years.value;
    if (body.renewal_enabled && !s.renewal_enabled && !confirm('Turn on annual renewal? Members whose membership started before the last renewal date will become PENDING until they are renewed.')) return;
    try {
      const saved = await api('/api/settings', { method: 'PUT', body });
      state.settings = { ...state.settings, ...saved };
      toast('Settings saved');
      loadSettingsForm(form);
    } catch (err) { toast(err.message, true); }
  });
}

const AUDIT_PAGE = 50;
const AUDIT_RANGES = [
  { h: 1, label: 'Last hour' }, { h: 24, label: 'Last 24 hours' }, { h: 168, label: 'Last 7 days' },
  { h: 720, label: 'Last 30 days' }, { h: 0, label: 'All (2 years)' },
];

async function viewSystem() {
  app.className = '';
  app.innerHTML = `${header('Admin', 'System · គ្រប់គ្រងប្រព័ន្ធ')}
    <section class="card"><h2>System users <small>អ្នកប្រើប្រព័ន្ធ</small></h2>
      <p class="hint" style="text-align:left;margin-top:0">Admins have full access. Moderators can review members and manage events.</p>
      <div id="users">${skeleton('lines', 3)}</div>
    </section>
    <form class="card" id="nu" autocomplete="off">
      <h2>Add system user <small>បន្ថែមអ្នកប្រើ</small></h2>
      <div class="grid2">
        <label class="field"><span class="lbl">Username</span><input name="username" required autocapitalize="none"></label>
        <label class="field"><span class="lbl">Role</span><select name="role"><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
        <label class="field"><span class="lbl">Temporary password<small>At least 8 characters – they must change it at first sign-in</small></span><input name="password" type="text" minlength="8" required></label>
        <label class="field"><span class="lbl">Sign-in email (optional)<small>Lets them sign in with this email or Google as well as the username</small></span><input name="email" type="email" autocapitalize="none" placeholder="name@example.com"></label>
      </div>
      <button class="btn block" type="submit">Create user</button>
      <p class="hint" style="text-align:left">To give a <b>member</b> moderator/admin rights, open them in Members › Account › Role.</p>
    </form>
    <section class="card" id="privreq"><h2>Privacy requests <small>សំណើឯកជនភាព</small></h2><div id="reqbody">${skeleton('lines', 1)}</div></section>
    <section class="card" id="chgreq"><h2>Change requests from members <small>សំណើកែប្រែព័ត៌មាន</small></h2><div id="chgbody">${skeleton('lines', 2)}</div></section>
    <form class="card" id="settings" autocomplete="off"><h2>Settings <small>ការកំណត់</small></h2>${skeleton('lines', 4)}</form>
    <section class="card"><h2>Backup &amp; restore <small>បម្រុងទុក និង ស្ដារ</small></h2>
      <p style="font-size:14px;margin-top:0">The backup contains the whole database (members, logins, events, association info) and all uploaded photos/files.
        It contains personal data – <b>set a passphrase</b> so the file is encrypted, and store it safely.</p>
      <label class="field"><span class="lbl">Passphrase (recommended)<small>At least 10 characters. Without it the backup cannot be restored – keep it safe.</small></span>
        <input type="password" id="bpass" autocomplete="new-password" placeholder="Leave empty for an unencrypted backup"></label>
      <div class="actions"><button class="btn" type="button" id="dl-backup">${ic('download')} Download backup</button></div>
      <details class="danger"><summary>Restore from a backup file</summary>
        <p>Restoring <b>replaces all current data</b> with the backup and signs everyone out. A safety copy of the current data is saved on the server first.</p>
        <input type="password" id="rpass" autocomplete="off" placeholder="Passphrase (if the backup is encrypted)" style="margin-bottom:8px">
        <div class="actions"><input type="file" id="rfile" accept=".gz,.json,.aisarc-enc,application/gzip,application/octet-stream" style="flex:1;min-width:200px"><button class="btn danger" id="restore" disabled>Restore</button></div>
      </details>
    </section>
    <section class="card" id="auditcard"><h2>Audit log <small>Who did what with personal data · កំណត់ត្រាសកម្មភាព</small></h2>
      <div class="audit-tools">
        <div class="search">${ICON.search}<input id="aq" type="search" placeholder="Search action, user, member:12…" autocomplete="off"></div>
        <select id="arange" aria-label="Time range">${AUDIT_RANGES.map((r) => `<option value="${r.h}" ${r.h === 1 ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>
      </div>
      <p class="hint" id="ainfo" style="text-align:left;margin:0 0 8px"></p>
      <div id="audit" class="audit">${skeleton('lines', 4)}</div>
      <div class="actions"><button class="btn sm light" type="button" id="amore" hidden>${ic('next')} Load older entries</button>
        <button class="btn sm light" type="button" id="awider" hidden>${ic('clock')} Show a longer period</button></div>
    </section>
    <a class="btn block light" href="#/association/edit">Edit association info</a>`;

  // Privacy requests (deletion) waiting for action.
  api('/api/privacy/requests').then((rows) => {
    $('#reqbody').innerHTML = rows.length ? rows.map((r) => `<a class="mrow" href="#/admin/m/${r.id}" style="margin-bottom:8px">
        <div class="info"><div class="n1">${esc(r.name_kh)} · ${esc(r.name_en)}</div>
        <div class="n2">Deletion requested ${esc(fmtDateTime(r.requested_at))} · due ${esc(fmtDate(new Date(new Date(r.requested_at).getTime() + 30 * 864e5).toISOString()))}</div>
        ${r.reason ? `<div class="n2">“${esc(r.reason)}”</div>` : ''}</div><span class="chip c-red">DELETE</span></a>`).join('')
      : '<p class="hint" style="text-align:left;margin:0">No open requests</p>';
  }).catch((e) => toast(e.message, true));

  // Change requests from members with a locked profile.
  const loadChanges = () => api('/api/change-requests?status=pending').then((rows) => {
    $('#chgbody').innerHTML = rows.length ? rows.map((r) => changeRequestHtml(r, true)).join('')
      : '<p class="hint" style="text-align:left;margin:0">No open requests</p>';
  }).catch((e) => toast(e.message, true));
  loadChanges();
  bindChangeDecisions($('#chgreq'), loadChanges);
  loadSettingsForm($('#settings'));

  // Audit log: only the last hour by default (50 entries per request). The admin widens the period or loads
  // older entries on demand, and nothing is requested until the section is scrolled into view.
  let lastId = null;
  let atimer;
  let aseq = 0;
  let shown = 0;
  const range = () => AUDIT_RANGES.find((r) => r.h === Number($('#arange').value)) || AUDIT_RANGES[0];
  const loadAudit = async (append = false) => {
    const my = ++aseq;
    const q = $('#aq').value.trim();
    if (!append) { lastId = null; shown = 0; $('#audit').innerHTML = skeleton('lines', 4); }
    $('#amore').disabled = true;
    try {
      const p = new URLSearchParams({ limit: AUDIT_PAGE, hours: range().h });
      if (q) p.set('q', q);
      if (append && lastId) p.set('before', lastId);
      const rows = await api(`/api/audit?${p}`);
      if (my !== aseq || !$('#audit')) return;
      const html = rows.map(auditRow).join('');
      if (append) $('#audit').insertAdjacentHTML('beforeend', html);
      else $('#audit').innerHTML = html || `<p class="hint" style="text-align:left;margin:0">No activity ${esc(range().label.toLowerCase())}${q ? ' matching the search' : ''}.</p>`;
      shown += rows.length;
      if (rows.length) lastId = rows[rows.length - 1].id;
      const more = rows.length === AUDIT_PAGE;
      $('#amore').hidden = !more;
      $('#amore').disabled = false;
      $('#awider').hidden = more || range().h === 0;
      $('#ainfo').textContent = `${shown}${more ? '+' : ''} entr${shown === 1 ? 'y' : 'ies'} · ${range().label}`;
    } catch (e) { if (my === aseq) toast(e.message, true); }
  };
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    io.disconnect();
    loadAudit();
  }, { rootMargin: '200px' });
  io.observe($('#auditcard'));
  $('#aq').addEventListener('input', () => { clearTimeout(atimer); atimer = setTimeout(() => loadAudit(), 300); });
  $('#arange').addEventListener('change', () => loadAudit());
  $('#amore').addEventListener('click', () => loadAudit(true));
  $('#awider').addEventListener('click', () => {
    const i = AUDIT_RANGES.indexOf(range());
    $('#arange').value = AUDIT_RANGES[Math.min(i + 1, AUDIT_RANGES.length - 1)].h;
    loadAudit();
  });

  $('#dl-backup').addEventListener('click', async () => {
    const passphrase = $('#bpass').value;
    if (passphrase && passphrase.length < 10) return toast('Passphrase must be at least 10 characters', true);
    if (!passphrase && !confirm('Download an UNENCRYPTED backup? Anyone who gets the file can read all member data.')) return;
    try {
      const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }), credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Backup failed');
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'aisarc-backup';
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await r.blob()), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast('Backup downloaded');
    } catch (e) { toast(e.message, true); }
  });
  const loadUsers = async () => {
    try {
      const users = await api('/api/users');
      $('#users').innerHTML = `<div class="ulist">${users.map((u) => `
        <div class="urow${u.id === state.user.id ? ' me' : ''}" data-id="${u.id}" data-username="${esc(u.username)}" data-mail="${esc(u.email || '')}" data-member="${u.member_id ? 1 : ''}">
          <div class="info"><div class="n1">${esc(u.username)}${u.id === state.user.id ? ' <small>(you)</small>' : ''}</div>
            <div class="n2">${u.member_no ? `Member ${esc(u.member_no)} · ${esc(u.name || '')}` : 'System account'}</div>
            ${u.email ? `<div class="n2 u-mail">${ic('mail')}<span>${esc(u.email)}</span>${u.shared_with_member ? '<span class="flag chg">also a member login</span>' : ''}</div>` : ''}</div>
          <div class="u-tools">
            <select data-role ${u.id === state.user.id ? 'disabled' : ''} aria-label="Role">
              ${(u.member_id ? ['member', 'moderator', 'admin'] : ['moderator', 'admin']).map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
            ${u.member_id ? '' : `<button type="button" class="icon-btn" data-act="rename" title="Edit username" aria-label="Edit username">${ic('edit')}</button>
              <button type="button" class="icon-btn" data-act="email" title="Sign-in email" aria-label="Sign-in email">${ic('mail')}</button>`}
            ${u.id === state.user.id
              ? `<a class="icon-btn" href="#/password" title="Change my password" aria-label="Change my password">${ICON.key}</a>
                 ${state.user.other_accounts ? `<button type="button" class="icon-btn" data-switch title="Switch account (this email opens another account)" aria-label="Switch account">${ICON.users}</button>` : ''}`
              : `<button type="button" class="icon-btn" data-act="reset" title="Reset password" aria-label="Reset password">${ICON.key}</button>`}
            ${u.id === state.user.id ? '' : `<button type="button" class="icon-btn del" data-act="del" title="${u.member_id ? 'Remove staff role' : 'Delete user'}" aria-label="${u.member_id ? 'Remove staff role' : 'Delete user'}">${ICON.trash}</button>`}
          </div>
        </div>`).join('')}</div>`;
    } catch (e) { toast(e.message, true); }
  };
  loadUsers();

  $('#users').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-role]')) return;
    const id = e.target.closest('.urow').dataset.id;
    try { await api(`/api/users/${id}`, { method: 'PUT', body: { role: e.target.value } }); toast('Role updated'); } catch (err) { toast(err.message, true); }
    loadUsers();
  });
  // Only the buttons act; clicking elsewhere on a row does nothing.
  $('#users').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    const row = btn?.closest('.urow');
    if (!row) return;
    const act = btn.dataset.act;
    const id = row.dataset.id;
    const name = row.dataset.username;
    const self = Number(id) === state.user.id;
    if (act === 'email') {
      const cur = row.dataset.mail;
      const d = modal(`<form method="dialog" id="em"><h3 style="margin-top:0">Sign-in email · អ៊ីម៉ែលចូលប្រើ</h3>
        <p class="hint" style="text-align:left;margin-top:0"><b>${esc(name)}</b> can sign in with this email (password or Google) as well as the username.
          If a member uses the same email, they choose which account to open when signing in.</p>
        <label class="field"><span class="lbl">Email</span><input type="email" name="email" value="${esc(cur)}" autocapitalize="none" placeholder="name@example.com"></label>
        <div class="actions">${cur ? '<button type="button" class="btn danger" data-clear>Remove</button>' : ''}<span style="flex:1"></span>
          <button type="button" class="btn light" data-close>Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
      const save = async (email) => {
        try {
          const r = await api(`/api/users/${id}`, { method: 'PUT', body: { email } });
          d.close();
          toast(r.shared_with_member ? 'Saved – this email also opens a member account; the person will choose at sign-in' : 'Sign-in email saved');
          if (self) state.user = (await api('/api/me')).user; // own email: refresh "switch account"
          loadUsers();
        } catch (err) { toast(err.message, true); }
      };
      d.querySelector('[data-close]').onclick = () => d.close();
      d.querySelector('[data-clear]')?.addEventListener('click', () => save(''));
      d.querySelector('#em').addEventListener('submit', (ev) => { ev.preventDefault(); save(ev.target.elements.email.value.trim()); });
    }
    if (act === 'rename') {
      const d = modal(`<form method="dialog" id="rn"><h3 style="margin-top:0">Edit username · កែឈ្មោះអ្នកប្រើ</h3>
        <p class="hint" style="text-align:left;margin-top:0">${self ? 'You' : `<b>${esc(name)}</b>`} will sign in with the new username from now on${row.dataset.mail ? ' (the sign-in email keeps working)' : ''}.</p>
        <label class="field"><span class="lbl">Username<small>3–64 letters, numbers or . _ @ + -</small></span>
          <input name="username" value="${esc(name)}" required autocapitalize="none" autocomplete="off" pattern="[\\w.@+\\-]{3,64}"></label>
        <div class="actions" style="justify-content:flex-end"><button type="button" class="btn light" data-close>Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
      d.querySelector('[data-close]').onclick = () => d.close();
      d.querySelector('#rn').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const username = ev.target.elements.username.value.trim();
        if (username === name) return d.close();
        try {
          await api(`/api/users/${id}`, { method: 'PUT', body: { username } });
          d.close();
          toast('Username changed');
          if (self) state.user = (await api('/api/me')).user;
          loadUsers();
        } catch (err) { toast(err.message, true); }
      });
    }
    if (act === 'del') {
      const member = !!row.dataset.member;
      const d = modal(`<form method="dialog" id="du" class="danger-dialog">
        <h3 style="margin-top:0" class="danger-title">${ic('alert')} ${member ? 'Remove staff role' : 'Delete system user'} · ${member ? 'ដកតួនាទី' : 'លុបអ្នកប្រើ'}</h3>
        <div class="notice red" style="margin-top:0">${member
          ? `<p><b>${esc(name)}</b> will lose their admin / moderator rights and be signed out. Their member record and login stay.</p>`
          : `<p><b>${esc(name)}</b> will be <b>deleted permanently</b> and signed out everywhere. They can no longer sign in. This cannot be undone.</p>`}</div>
        <label class="field"><span class="lbl">Type the username to confirm<small>${esc(name)}</small></span>
          <input name="confirm" autocomplete="off" autocapitalize="none" data-icon="alert"></label>
        <div class="actions" style="justify-content:flex-end"><button type="button" class="btn light" data-close>Cancel</button>
          <button class="btn btn-danger" type="submit" disabled>${ICON.trash} ${member ? 'Remove role' : 'Delete permanently'}</button></div></form>`);
      const f = d.querySelector('#du');
      d.querySelector('[data-close]').onclick = () => d.close();
      f.elements.confirm.addEventListener('input', (ev) => { f.querySelector('[type=submit]').disabled = ev.target.value.trim().toLowerCase() !== name.toLowerCase(); });
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          await api(`/api/users/${id}`, { method: 'DELETE', body: { confirm: f.elements.confirm.value.trim() } });
          d.close();
          toast(member ? 'Staff role removed' : 'User deleted');
          loadUsers();
        } catch (err) { toast(err.message, true); }
      });
    }
    if (act === 'reset') {
      if (!confirm(`Generate a new temporary password for ${name}?`)) return;
      try {
        const r = await api(`/api/users/${id}/password`, { body: {} });
        const d = modal(`<h3 style="margin-top:0">Temporary password</h3><p>Share it privately. It expires in 72 hours and must be changed at first sign-in.</p>
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
      await api('/api/users', { body: { username: f.username.value.trim(), role: f.role.value, password: f.password.value, email: f.email.value.trim() } });
      toast('User created');
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
      const res = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Backup-Passphrase': encodeURIComponent($('#rpass').value) }, body: file, credentials: 'same-origin' });
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
const priceText = (e) => (e.price > 0 ? `${Number(e.price).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${e.currency || 'USD'}` : 'Free · ឥតគិតថ្លៃ');
const closeText = (e) => new Date(e.registration_closes_at).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
let billBusy = 0;

let livePoll;
const mapBtn = (e, cls = 'btn sm light') => (e.map_link && /^https:\/\//.test(e.map_link)
  ? `<a class="${cls}" href="${esc(e.map_link)}" target="_blank" rel="noopener noreferrer">${ICON.pin} Google Maps</a>` : '');

const PHASES = [
  { key: 'ongoing', kh: 'កំពុងប្រព្រឹត្តទៅ', en: 'Happening now' },
  { key: 'upcoming', kh: 'នាពេលខាងមុខ', en: 'Upcoming' },
  { key: 'past', kh: 'បានបញ្ចប់', en: 'Past events' },
];

function eventCard(e) {
  const badge = e.phase === 'ongoing' ? '<span class="chip c-live"><i class="live-dot"></i>LIVE</span>'
    : e.joined ? '<span class="chip c-green">Joined</span>'
    : e.phase === 'past' ? '<span class="chip c-grey">Ended</span>'
    : e.seats && !e.seats_left ? '<span class="chip c-red">Full</span>'
    : !e.registration_open ? '<span class="chip c-grey">Closed</span>' : '';
  return `
    <a class="ecard ${e.phase}" href="#/events/${e.id}">
      <div class="edate"><b>${esc(new Date(e.starts_at).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' }))}</b>
        <span>${esc(new Date(e.starts_at).toLocaleDateString('en-GB', { timeZone: TZ, month: 'short' }))}</span></div>
      <div class="info"><div class="n1">${esc(e.title)}</div>
        <div class="n2">${ICON.clock}${esc(fmtEventTime(e))}</div>
        ${e.location ? `<div class="n2">${ICON.pin}${esc(e.location)}</div>` : ''}
        <div class="n2">${ICON.seat}${esc(seatsText(e))}</div>
        <div class="n2">${ic('cash')}${esc(priceText(e))}</div>
        ${e.phase === 'upcoming' && e.close_days > 0
          ? `<div class="n2 ${e.registration_open ? '' : 'closed'}">${ic('hourglass')}${e.registration_open ? 'Register by' : 'Registration closed'} ${esc(closeText(e))}</div>` : ''}${seatBar(e)}</div>
      ${badge}
    </a>`;
}

async function viewEvents() {
  app.className = '';
  app.innerHTML = `${header('Events', 'ព្រឹត្តិការណ៍')}
    ${isStaff() ? '<div class="actions" style="margin-bottom:12px"><a class="btn" href="#/events/new">+ New event</a></div>' : ''}
    <div id="elist">${skeleton('events', 3)}</div>`;
  let pastOpen = false;
  const load = async () => {
    if (!$('#elist')) return clearInterval(livePoll);
    pastOpen = $('#past-events')?.open ?? pastOpen;
    try {
      const evs = await api('/api/events');
      if (!evs.length) { $('#elist').innerHTML = '<div class="empty">No events yet · មិនទាន់មានព្រឹត្តិការណ៍</div>'; return; }
      $('#elist').innerHTML = PHASES.map((p) => {
        const list = evs.filter((e) => e.phase === p.key);
        if (p.key === 'ongoing' && !list.length) return '';
        const head = `<h2 class="esec-title ${p.key}">${p.key === 'ongoing' ? '<i class="live-dot"></i>' : ''}${esc(p.kh)} <small>${esc(p.en)} · ${list.length}</small></h2>`;
        const body = list.length ? `<div class="elist">${list.map(eventCard).join('')}</div>`
          : `<div class="empty small">${p.key === 'upcoming' ? 'No upcoming events · មិនទាន់មានព្រឹត្តិការណ៍ថ្មី' : 'No past events'}</div>`;
        if (p.key === 'past') return list.length ? `<details class="esec" id="past-events" ${pastOpen ? 'open' : ''}><summary>${head}</summary>${body}</details>` : '';
        return `<section class="esec">${head}${body}</section>`;
      }).join('');
    } catch (err) { toast(err.message, true); }
  };
  await load();
  clearInterval(livePoll);
  livePoll = setInterval(load, 15000);
}

async function viewEvent(id) {
  app.className = '';
  app.innerHTML = skeleton('page', 2);
  const render = (e) => {
    const canJoin = state.user.member_id && e.phase === 'upcoming';
    const member = state.member;
    const full = e.seats && !e.seats_left;
    const phase = PHASES.find((p) => p.key === e.phase);
    const paid = e.price > 0;
    const showBill = paid || e.participants.some((p) => p.bill);
    const billBox = e.joined && paid && e.phase !== 'past' ? `
      <div class="notice ${e.my_bill ? 'green' : 'orange'} bill-box">
        <b>${ic(e.my_bill ? 'check' : 'cash')} ${e.my_bill ? 'Payment proof uploaded · បានផ្ញើវិក្កយបត្រ' : 'Payment proof · វិក្កយបត្របង់ប្រាក់'}</b>
        <p>${e.my_bill ? `Uploaded ${esc(fmtDateTime(e.my_bill_at))}. <a href="${esc(fileUrl(e.my_bill))}" target="_blank" rel="noopener noreferrer">View</a> · You can replace it if needed.`
          : `Please pay <b>${esc(priceText(e))}</b> (see <a href="#/association">bank details</a>) and upload a photo of the receipt.`}</p>
        <label class="btn sm ${e.my_bill ? 'light' : ''} upl">${ic('upload')} ${e.my_bill ? 'Replace proof' : 'Upload proof'}<input type="file" id="bill" accept="image/*,application/pdf" hidden></label>
      </div>` : '';
    const regClosed = canJoin && !e.joined && !e.registration_open;
    app.innerHTML = `${header('Event', 'ព្រឹត្តិការណ៍', '/events')}
      <section class="card event-detail">
        <span class="chip ${e.phase === 'ongoing' ? 'c-live' : e.phase === 'past' ? 'c-grey' : 'c-green'}" style="display:inline-flex;margin-bottom:8px">
          ${e.phase === 'ongoing' ? '<i class="live-dot"></i>' : ''}${esc(phase.kh)} · ${esc(phase.en)}</span>
        <h2 style="font-size:20px;line-height:1.4">${esc(e.title)}</h2>
        <dl class="kv">
          <dt>${ICON.clock}</dt><dd>${esc(fmtEventTime(e))}</dd>
          ${e.location || e.map_link ? `<dt>${ICON.pin}</dt><dd>${esc(e.location || '')}${mapBtn(e) ? `<div style="margin-top:6px">${mapBtn(e)}</div>` : ''}</dd>` : ''}
          <dt>${ic('cash')}</dt><dd><b>${esc(priceText(e))}</b></dd>
          ${e.phase === 'upcoming' && e.close_days > 0 ? `<dt>${ic('hourglass')}</dt><dd>${e.registration_open ? 'Registration closes' : '<b class="closed">Registration closed</b>'} ${esc(closeText(e))}
            <small class="muted">(${e.close_days} day${e.close_days === 1 ? '' : 's'} before the start)</small></dd>` : ''}
          <dt>${ICON.seat}</dt><dd><span class="live-dot"></span><span id="seats">${esc(seatsText(e))}</span>${seatBar(e)}</dd>
        </dl>
        ${e.description ? `<p class="pre" style="font-size:14px;line-height:1.7">${esc(e.description)}</p>` : ''}
        ${canJoin ? (e.joined
          ? `<div class="notice green" style="margin-bottom:0"><b>${ic('check')} You joined this event</b><div class="actions"><button class="btn sm light" id="leave">Cancel my seat</button></div></div>${billBox}`
          : regClosed ? `<div class="notice grey" style="margin-bottom:0"><b>Registration closed · ផុតកំណត់ចុះឈ្មោះ</b><br>Registration ended on ${esc(closeText(e))}.</div>`
          : member?.status !== 'ACTIVE' ? '<div class="notice grey" style="margin-bottom:0">Only ACTIVE members can join events.</div>'
          : `<button class="btn block" id="join" ${full ? 'disabled' : ''}>${full ? 'Event is full' : `Join this event · ចូលរួម${paid ? ` (${esc(priceText(e))})` : ''}`}</button>`)
          : e.phase === 'past' ? '<div class="notice grey" style="margin-bottom:0">This event has ended.</div>'
          : e.phase === 'ongoing' ? `<div class="notice green" style="margin-bottom:0">${e.joined ? `<b>${ic('check')} You joined this event.</b> ` : ''}This event is happening now.</div>${billBox}` : ''}
      </section>
      <section class="card"><div class="sec-head"><h2>អ្នកចូលរួម <small>Joined members (${e.joined_count}) · live</small></h2>
        ${isStaff() && e.participants.length ? `<button class="btn sm light" type="button" id="jexport">${ic('download')} Export to Excel</button>` : ''}</div>
        ${!isStaff() ? `<p class="hint" style="text-align:left;margin:0"><b>${e.joined_count}</b> member${e.joined_count === 1 ? ' has' : 's have'} joined${e.joined ? ', including you' : ''}.
            For privacy, only the organisers can see the list of names.</p>`
        : e.participants.length ? `${paid ? `<p class="hint" style="text-align:left;margin-top:0">Payment proofs: <b>${e.participants.filter((p) => p.bill).length} / ${e.participants.length}</b> uploaded</p>` : ''}
          <div class="plist">${e.participants.map((p, i) => `
          <div class="prow"><span class="pn">${i + 1}</span><div class="info">
            <div class="n1">${p.member_id ? `<a href="#/admin/m/${p.member_id}">` : ''}${esc(p.name_kh)} · ${esc(p.name_en)}${p.member_id ? '</a>' : ''}</div>
            <div class="n2">${esc(p.member_no || '—')} · ${esc(p.gender || '—')}${p.phone ? ` · ${esc(p.phone)}` : ''}</div>
            ${p.workplace ? `<div class="n2">${ic('building')}${esc(p.workplace)}</div>` : ''}
            ${p.training ? `<div class="n2">${ic('cap')}${esc(p.training)}</div>` : ''}</div>
            ${showBill ? (p.bill ? `<a class="bill-thumb" href="${esc(fileUrl(p.bill))}" target="_blank" rel="noopener noreferrer" title="Payment proof ${esc(fmtDateTime(p.bill_at))}">
                ${/\.pdf$/i.test(p.bill) ? '<span>PDF</span>' : `<img src="${esc(fileUrl(p.bill))}" alt="Bill" loading="lazy" data-rm>`}<small>${ic('check')} Bill</small></a>`
              : '<span class="chip c-grey">No bill</span>') : ''}
          </div>`).join('')}</div>`
          : '<div class="empty" style="padding:16px 0">No one has joined yet</div>'}
      </section>
      ${isStaff() ? `<div class="actions"><a class="btn light" href="#/events/${e.id}/edit">Edit event</a><button class="btn danger" id="edel">Delete event</button></div>` : ''}`;
    $('#jexport')?.addEventListener('click', () => {
      if (confirm('The Excel file contains personal data of the members who joined. Keep it safe and delete it when no longer needed. Continue?')) location.href = `/api/events/${id}/export.xlsx`;
    });
    $('#bill')?.closest('label').addEventListener('click', () => (billBusy = Date.now()));
    $('#bill')?.addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return (billBusy = 0);
      try {
        await api(`/api/events/${id}/bill`, { body: { dataUrl: await readFile(file, 1600) } });
        toast('Payment proof uploaded');
      } catch (err) { toast(err.message, true); }
      billBusy = 0;
      refresh();
    });
    const act = async (method) => {
      try { await api(`/api/events/${id}/join`, { method, body: {} }); toast(method === 'POST' ? 'Joined' : 'Seat cancelled'); refresh(); } catch (err) { toast(err.message, true); refresh(); }
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
  // Live seat count: refresh while this page is open (skip while a dialog or the tour is open).
  clearInterval(livePoll);
  livePoll = setInterval(() => {
    if (!location.hash.startsWith(`#/events/${id}`) || location.hash.endsWith('/edit')) return clearInterval(livePoll);
    if (!document.querySelector('dialog[open], .tour') && Date.now() - billBusy > 120000) refresh();
  }, 5000);
}

async function viewEventEdit(id) {
  app.className = '';
  const isNew = id === 'new';
  let e = { title: '', location: '', map_url: '', description: '', seats: 0, price: 0, close_days: 0, starts_at: '', ends_at: '' };
  let currency = 'USD';
  if (!isNew) {
    app.innerHTML = skeleton('page', 2);
    try { e = await api(`/api/events/${id}`); currency = e.currency || currency; } catch (err) { toast(err.message, true); return go('/events'); }
  } else {
    try { currency = (await api('/api/association')).currency || currency; } catch { /* default */ }
  }
  app.innerHTML = `${header(isNew ? 'New event' : 'Edit event', 'ព្រឹត្តិការណ៍', isNew ? '/events' : `/events/${id}`)}
    <form class="card" id="ef" novalidate>
      <label class="field"><span class="lbl">ឈ្មោះព្រឹត្តិការណ៍ *<small>Event name</small></span><input name="title" required value="${esc(e.title)}"></label>
      <label class="field"><span class="lbl">ទីកន្លែង<small>Location (a Google Maps search link is created automatically)</small></span><input name="location" value="${esc(e.location)}"></label>
      <label class="field"><span class="lbl">តំណ Google Maps<small>Optional exact map link – in Google Maps tap Share › Copy link (https://maps.app.goo.gl/…)</small></span>
        <input name="map_url" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/..." value="${esc(e.map_url || '')}"></label>
      <div class="actions" style="margin:0 0 12px"><button type="button" class="btn sm light" id="testmap">${ICON.pin} Test map link</button></div>
      <div class="grid2">
        <label class="field"><span class="lbl">ចាប់ផ្ដើម *<small>Starts (date &amp; time)</small></span><input type="datetime-local" name="starts_at" required value="${esc(toLocalInput(e.starts_at))}"></label>
        <label class="field"><span class="lbl">បញ្ចប់<small>Ends (optional – otherwise 3 hours)</small></span><input type="datetime-local" name="ends_at" value="${esc(toLocalInput(e.ends_at))}"></label>
      </div>
      <label class="field"><span class="lbl">ចំនួនកៅអី<small>Seats available (0 = unlimited)</small></span>
        <div class="unit"><input type="number" name="seats" min="0" step="1" inputmode="numeric" value="${esc(e.seats)}"><span>កៅអី</span></div></label>
      <div class="grid2">
        <label class="field"><span class="lbl">តម្លៃ<small>Price per member (0 = free)</small></span>
          <div class="unit"><input type="number" name="price" min="0" step="0.01" inputmode="decimal" value="${esc(e.price || 0)}"><span>${esc(currency)}</span></div></label>
        <label class="field"><span class="lbl">បិទការចុះឈ្មោះ<small>Close registration … days before the start (0 = until it starts)</small></span>
          <div class="unit"><input type="number" name="close_days" min="0" max="365" step="1" inputmode="numeric" value="${esc(e.close_days || 0)}"><span>ថ្ងៃ · days</span></div></label>
      </div>
      <p class="hint" id="closehint" style="text-align:left;margin:-8px 0 16px"></p>
      <label class="field"><span class="lbl">ការពិពណ៌នា<small>Description</small></span><textarea name="description" rows="6">${esc(e.description)}</textarea></label>
      <button class="btn block" type="submit">${isNew ? 'Publish event' : 'Save changes'}</button>
    </form>`;
  const f = $('#ef').elements;
  const closeHint = () => {
    const s = fromLocalInput(f.starts_at.value);
    const d = parseInt(f.close_days.value, 10) || 0;
    $('#closehint').textContent = s && d > 0
      ? `Members can join until ${closeText({ registration_closes_at: new Date(new Date(s).getTime() - d * 864e5).toISOString() })}.` : '';
  };
  closeHint();
  f.starts_at.addEventListener('input', closeHint);
  f.close_days.addEventListener('input', closeHint);
  $('#testmap').addEventListener('click', () => {
    const url = f.map_url.value.trim() || (f.location.value.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.location.value.trim())}` : '');
    if (!/^https:\/\//.test(url)) return toast('Enter a location or a Google Maps link first', true);
    window.open(url, '_blank', 'noopener');
  });
  $('#ef').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = {
      title: f.title.value, location: f.location.value, map_url: f.map_url.value.trim(), description: f.description.value, seats: f.seats.value,
      price: f.price.value, close_days: f.close_days.value,
      starts_at: fromLocalInput(f.starts_at.value), ends_at: fromLocalInput(f.ends_at.value),
    };
    try {
      const r = await api(isNew ? '/api/events' : `/api/events/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast('Saved');
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
      <p class="hint">Members: sign in with Google using the email you registered with. Forgot your password? Contact the AISARC admin.</p>
    </form></div>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      const r = await api('/api/login', { body: { username: f.username.value.trim(), password: f.password.value } });
      if (r.choose) return go('/choose');
      await afterLogin(r.user);
    } catch (err) { $('#lerr').textContent = err.message; }
  });
  initGoogle();
  const err = new URLSearchParams(location.hash.split('?')[1] || '').get('error');
  if (err) $('#lerr').textContent = err;
}

// Several accounts share the email that was just used to sign in: pick one.
const ROLE_TEXT = { admin: ['អ្នកគ្រប់គ្រង', 'Admin'], moderator: ['អ្នកសម្របសម្រួល', 'Moderator'], member: ['សមាជិក', 'Member'] };
async function viewChoose() {
  tabbar.hidden = true;
  app.className = '';
  app.innerHTML = `<div class="login">${brand}<div class="card">${skeleton('lines', 2)}</div></div>`;
  let list;
  try { list = (await api('/api/login/choices')).accounts; } catch (e) { return go(`/login?error=${encodeURIComponent(e.message)}`); }
  app.innerHTML = `<div class="login">${brand}
    <div class="card"><h2>ជ្រើសរើសគណនី <small>Choose an account</small></h2>
      <p class="hint" style="text-align:left;margin:0 0 14px">This email is used by more than one account. Which one do you want to use now?</p>
      <div class="choose-list">${list.map((a) => {
        const [kh, en] = ROLE_TEXT[a.role] || [a.role, a.role];
        return `<button type="button" class="choose-item" data-id="${a.id}">
          <span class="ci-icon">${a.member ? ICON.pass : ICON.shield}</span>
          <span class="ci-text"><b>${a.member ? `${esc(a.name_kh || a.name_en)} · Member account` : `${esc(en)} account`}</b>
            <small>${a.member ? `${esc(a.member_no || 'New applicant')}${a.role !== 'member' ? ` · also ${esc(en)}` : ''}` : `${esc(kh)} · ${esc(a.username)}`}</small></span>
          ${ICON.next}</button>`;
      }).join('')}</div>
      <p class="err" id="cerr"></p>
      <div class="actions"><a class="btn light block" href="#/login">Cancel · បោះបង់</a></div>
    </div></div>`;
  app.querySelector('.choose-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    b.disabled = true;
    try {
      const r = await api('/api/login/choose', { body: { id: Number(b.dataset.id) } });
      await afterLogin(r.user);
    } catch (err) { $('#cerr').textContent = err.message; b.disabled = false; }
  });
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
      <label class="check"><input type="checkbox" name="privacy"><span>ខ្ញុំបានអាន និង យល់ព្រមលើ <a href="#/privacy" target="_blank">សេចក្តីជូនដំណឹងអំពីឯកជនភាព</a>។
        I have read and accept the <a href="#/privacy" target="_blank">privacy notice</a> (how my personal data is used, who can see it and my rights).</span></label>
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
    if (!f.privacy.checked) return ($('#rerr').textContent = 'Please accept the privacy notice · សូមយល់ព្រមលើសេចក្តីជូនដំណឹងអំពីឯកជនភាព');
    try {
      const r = await api('/api/register', { body: {
        name_kh: f.name_kh.value, name_en: f.name_en.value, email: f.email.value, phone: f.phone.value, password: f.password.value, consent: true, privacy: true,
      } });
      state.user = r.user;
      const me = await api('/api/me');
      state.member = me.member;
      state.settings = me.settings;
      toast('Registered. Please complete your profile');
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
          if (r.choose) return go('/choose');
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
  state.settings = me.settings;
  go(user.must_change ? '/password' : home());
}

const home = () => (state.user?.member_id
  ? (['DRAFT', 'REJECTED'].includes(state.member?.status) ? '/profile' : '/pass')
  : isStaff() ? '/admin' : '/association');

// ---------- router ----------
async function route() {
  const path = location.hash.slice(1).split('?')[0] || '/';
  if (!state.config) {
    state.config = await api('/api/config').catch(() => ({}));
    $('#ver').innerHTML = `AISARC Membership${state.config.version ? ` · v${esc(state.config.version)}` : ''} · <a href="#/privacy">ឯកជនភាព · Privacy</a>`;
  }
  // The privacy notice is public: people must be able to read it before registering.
  if (path === '/privacy') {
    window.scrollTo(0, 0);
    if (state.user) setTabs(''); else tabbar.hidden = true;
    return viewPrivacy();
  }
  if (!state.user && !state.checked) {
    state.checked = true;
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.member = me.member;
      state.settings = me.settings;
    } catch { /* not signed in */ }
  }
  if (!state.user) {
    if (path === '/register') return viewRegister();
    if (path === '/choose') return viewChoose();
    return path === '/login' ? viewLogin() : go('/login');
  }
  if (['/login', '/register', '/'].includes(path)) return go(home());
  if (state.user.must_change && path !== '/password') return go('/password');

  window.scrollTo(0, 0);
  clearInterval(livePoll);
  maybeAutoTour(state.user, state.member);
  if (path === '/pass' && state.member) { setTabs('/pass'); return viewPass(); }
  if (path === '/profile' && state.member) { setTabs('/profile'); return viewProfile(); }
  if (path === '/password') { setTabs(''); return viewPassword(); }
  if (path === '/account') { if (state.member || isAdmin()) return go(accountHome()); setTabs('/account'); return viewAccount(); }
  // Already signed in (e.g. Google redirect while a session exists): still allow picking another account.
  if (path === '/choose') return viewChoose();
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
