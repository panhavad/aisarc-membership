// Guided system tour (Khmer + English). Each step can switch page (route), then spotlights an element.

const T = (kh, en, titleKh, titleEn) => ({ kh, en, titleKh, titleEn });
const svg = (d) => `<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const IC = { x: svg('M6 6l12 12M18 6 6 18'), back: svg('M19 12H5M11 6l-6 6 6 6'), next: svg('M5 12h14M13 6l6 6-6 6') };

const STEPS = {
  applicant: [
    { ...T('សូមស្វាគមន៍មកកាន់ប្រព័ន្ធសមាជិក AISARC! យើងនឹងបង្ហាញអ្នកពីរបៀបប្រើប្រាស់។', 'Welcome to the AISARC membership portal! Let us show you around.', 'សូមស្វាគមន៍', 'Welcome') },
    { route: '/profile', el: '#progress', ...T('ជាដំបូង សូមបំពេញព័ត៌មានរបស់អ្នក។ របារនេះបង្ហាញថាអ្នកបានបំពេញប៉ុន្មានហើយ។ ចុចលើឈ្មោះនីមួយៗ ដើម្បីទៅកាន់ចន្លោះដែលនៅខ្វះ។', 'First, complete your profile. This bar shows your progress – tap an item to jump to what is still missing.', 'បំពេញព័ត៌មាន', 'Complete your profile') },
    { route: '/profile', el: '.req', ...T('ចន្លោះដែលមានសញ្ញា * គឺចាំបាច់ត្រូវបំពេញ មុនពេលដាក់ស្នើ។', 'Items marked * are required before you can submit.', 'ចន្លោះចាំបាច់', 'Required items') },
    { route: '/profile', el: '[data-field="photo"]', ...T('សូមបញ្ចូលរូបថត 4x6 របស់អ្នក។ រូបនេះនឹងបង្ហាញលើកាតសមាជិក។', 'Upload your 4x6 photo. It appears on your membership card.', 'រូបថត', 'Photo') },
    { route: '/profile', el: '#submitReview', ...T('ពេលបំពេញរួច ចុច «ដាក់ស្នើ» ដើម្បីឱ្យអ្នកសម្របសម្រួលពិនិត្យ និង អនុម័ត។ ចុច «រក្សាទុក» ដើម្បីរក្សាទុកហើយបន្តពេលក្រោយ។', 'When everything is complete, tap "Submit for review" so a moderator can approve you. Use "Save" to continue later.', 'ដាក់ស្នើ', 'Submit for review') },
    { el: '#tabbar a[href="#/pass"]', ...T('កាតសមាជិករបស់អ្នក និង ស្ថានភាពនៃពាក្យសុំ នៅទីនេះ។', 'Your membership card and application status are here.', 'កាតសមាជិក', 'Your pass') },
    { el: '#tabbar a[href="#/association"]', ...T('ព័ត៌មានសមាគម និង គណនីធនាគារសម្រាប់បង់ថ្លៃសមាជិកភាព។', 'Association info and the bank account for the membership fee.', 'សមាគម', 'Association') },
    { el: '[data-tour]', ...T('ចុចប៊ូតុង ? នេះ ពេលណាក៏បាន ដើម្បីមើលការណែនាំម្ដងទៀត។', 'Tap this ? button any time to see this tour again.', 'ជំនួយ', 'Help') },
  ],
  member: [
    { ...T('សូមស្វាគមន៍! នេះជាការណែនាំខ្លីអំពីប្រព័ន្ធសមាជិក AISARC។', 'Welcome! Here is a short tour of the AISARC membership portal.', 'សូមស្វាគមន៍', 'Welcome') },
    { route: '/pass', el: '.pass', ...T('នេះជាកាតសមាជិកឌីជីថលរបស់អ្នក។ បង្ហាញវាពេលចូលរួមកម្មវិធី។', 'This is your digital membership card. Show it at events and activities.', 'កាតសមាជិក', 'Your pass') },
    { route: '/pass', el: '.pass-pill', ...T('ស្ថានភាពសមាជិកភាព៖ ACTIVE (បៃតង) មានន័យថាសកម្ម។ ពណ៌ផ្សេងទៀតមានន័យថាត្រូវការសកម្មភាព – សូមអានសារខាងក្រោមកាត។', 'Membership status: ACTIVE (green) means all good. Other colours need an action – read the message below the card.', 'ស្ថានភាព', 'Status') },
    { route: '/pass', el: '.pass-clock', optional: true, ...T('ពន្លឺរត់កាត់កាត និង ម៉ោងបច្ចុប្បន្ន បញ្ជាក់ថាកាតនេះពិត មិនមែនជារូបថតអេក្រង់ទេ។', 'The moving shine and the live clock prove the pass is real, not a screenshot.', 'កាតពិត', 'Live pass') },
    { el: '#tabbar a[href="#/profile"]', ...T('មើល និង កែប្រែព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក។ ក្រោយរយៈពេលកែប្រែបានបញ្ចប់ ព័ត៌មានត្រូវចាក់សោ – ចុច «ស្នើកែប្រែ» លើផ្នែកនីមួយៗ ដើម្បីផ្ញើទៅអ្នកគ្រប់គ្រងពិនិត្យ។', 'View and edit your personal information. After the edit period it is locked – tap "Request change" on a section to send changes to an admin for review.', 'ព័ត៌មានផ្ទាល់ខ្លួន', 'Profile') },
    { el: '#tabbar a[href="#/events"]', ...T('មើលព្រឹត្តិការណ៍ និង ចុះឈ្មោះចូលរួម មុនថ្ងៃបិទការចុះឈ្មោះ។ សម្រាប់ព្រឹត្តិការណ៍បង់ប្រាក់ សូមបញ្ចូលរូបវិក្កយបត្រក្រោយពេលបង់ប្រាក់។', 'See events and join before registration closes. For paid events, upload a photo of your payment receipt after paying.', 'ព្រឹត្តិការណ៍', 'Events') },
    { el: '#tabbar a[href="#/association"]', ...T('ព័ត៌មានសមាគម និង គណនីធនាគារសម្រាប់បង់ថ្លៃសមាជិកភាព។', 'Association info and the bank account for the membership fee.', 'សមាគម', 'Association') },
    { el: '.top a[href="#/password"]', ...T('ប្ដូរពាក្យសម្ងាត់របស់អ្នកនៅទីនេះ។', 'Change your password here.', 'ពាក្យសម្ងាត់', 'Password') },
    { el: '[data-tour]', ...T('ចុចប៊ូតុង ? នេះ ពេលណាក៏បាន ដើម្បីមើលការណែនាំម្ដងទៀត។', 'Tap this ? button any time to see this tour again.', 'ជំនួយ', 'Help') },
  ],
  moderator: [
    { ...T('សូមស្វាគមន៍ អ្នកសម្របសម្រួល! អ្នកពិនិត្យ និង អនុម័តសមាជិកថ្មី ហើយគ្រប់គ្រងព្រឹត្តិការណ៍។', 'Welcome, moderator! You review and approve new members and manage events.', 'សូមស្វាគមន៍', 'Welcome') },
    { route: '/admin', el: '#filters', ...T('តម្រងស្ថានភាព។ «Review» បង្ហាញសមាជិកដែលកំពុងរង់ចាំការពិនិត្យ។', 'Status filters. "Review" lists members waiting for your decision.', 'តម្រង', 'Filters') },
    { route: '/admin', el: '.search', ...T('ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ អ៊ីម៉ែល ឬ កន្លែងធ្វើការ។', 'Search by name, phone, email or workplace.', 'ស្វែងរក', 'Search') },
    { route: '/admin', el: '.mrow', optional: true, ...T('ចុចលើសមាជិកម្នាក់ ដើម្បីពិនិត្យព័ត៌មាន រួចចុច «Approve» ឬ «Reject»។ ពេលបដិសេធ ត្រូវជ្រើសមូលហេតុ ដើម្បីឱ្យសមាជិកកែតម្រូវ។', 'Open a member to check their details, then Approve or Reject. When rejecting, choose a reason so they can fix it.', 'ពិនិត្យ', 'Review') },
    { route: '/events', el: 'a[href="#/events/new"]', ...T('បង្កើតព្រឹត្តិការណ៍ថ្មី ដែលសមាជិកអាចចុះឈ្មោះចូលរួម។ បើកព្រឹត្តិការណ៍ ដើម្បីមើលអ្នកចូលរួម និង នាំចេញជា Excel។', 'Create a new event that members can join. Open an event to see who joined and export the list to Excel.', 'ព្រឹត្តិការណ៍', 'Events') },
    { el: '[data-tour]', ...T('ចុចប៊ូតុង ? នេះ ពេលណាក៏បាន ដើម្បីមើលការណែនាំម្ដងទៀត។', 'Tap this ? button any time to see this tour again.', 'ជំនួយ', 'Help') },
  ],
  admin: [
    { ...T('សូមស្វាគមន៍ អ្នកគ្រប់គ្រង! នេះជាការណែនាំអំពីមុខងារគ្រប់គ្រង។', 'Welcome, admin! Here is a tour of the management features.', 'សូមស្វាគមន៍', 'Welcome') },
    { route: '/admin', el: '.search', ...T('ស្វែងរកសមាជិកតាមឈ្មោះ លេខទូរស័ព្ទ អ៊ីម៉ែល លេខសមាជិក ឬ កន្លែងធ្វើការ។', 'Search members by name, phone, email, membership no. or workplace.', 'ស្វែងរក', 'Search') },
    { route: '/admin', el: '#filters', ...T('តម្រងតាមស្ថានភាព និង «Duplicate» (កំណត់ត្រាដែលអាចស្ទួន) «Change requests» (សំណើកែប្រែ) និង កម្រិតសមាជិក។', 'Filter by status, by "Duplicate" (records that may be the same person), "Change requests" and by member level.', 'តម្រង', 'Filters') },
    { route: '/admin', el: '#toolbar', ...T('បន្ថែមសមាជិក ជ្រើសរើសសមាជិក និង នាំចេញជា Excel។ «Export» នាំចេញតែសមាជិកដែលកំពុងបង្ហាញ (តាមការស្វែងរក និង តម្រង)។', 'Add members, select members and export to Excel. "Export" downloads exactly the members shown (current search and filter).', 'ឧបករណ៍', 'Tools') },
    { route: '/admin', el: '.mrow', optional: true, ...T('ចុចលើសមាជិក ដើម្បីកែប្រែព័ត៌មាន អនុម័ត/បដិសេធ ធ្វើឱ្យសកម្ម/អសកម្ម ប្ដូរតួនាទី ឬ កំណត់ពាក្យសម្ងាត់ថ្មី។', 'Open a member to edit details, approve/reject, activate/deactivate, change role or reset the password.', 'សមាជិក', 'Member page') },
    { route: '/system', el: '#users', ...T('គ្រប់គ្រងអ្នកប្រើប្រព័ន្ធ៖ បន្ថែម ឬ ដកអ្នកគ្រប់គ្រង និង អ្នកសម្របសម្រួល។', 'Manage system users: add or remove admins and moderators.', 'អ្នកប្រើប្រព័ន្ធ', 'System users') },
    { route: '/system', el: '#dl-backup', ...T('ទាញយកឯកសារបម្រុងទុកនៃទិន្នន័យទាំងអស់ជាប្រចាំ ដោយដាក់ពាក្យសម្ងាត់ (passphrase) ដើម្បីអ៊ិនគ្រីប ហើយរក្សាទុកឱ្យមានសុវត្ថិភាព។', 'Download a full backup regularly – set a passphrase so it is encrypted – and keep it safe.', 'បម្រុងទុក', 'Backup') },
    { route: '/system', el: '#privreq', ...T('សំណើរបស់សមាជិកឱ្យលុបទិន្នន័យ។ ត្រូវដោះស្រាយក្នុងរយៈពេល 30 ថ្ងៃ។ កំណត់ត្រាសកម្មភាពបង្ហាញថាអ្នកណាបានមើល ឬ កែប្រែព័ត៌មាន។', 'Members’ deletion requests – handle them within 30 days. The audit log below shows who viewed or changed personal data.', 'ឯកជនភាព', 'Privacy') },
    { route: '/system', el: '#chgreq', ...T('ពេលព័ត៌មានសមាជិកត្រូវបានចាក់សោ សមាជិកផ្ញើសំណើកែប្រែតាមផ្នែក។ ពិនិត្យ រួចអនុម័ត (កែប្រែភ្លាម) ឬ បដិសេធ (ត្រូវសរសេរមូលហេតុ)។', 'When a profile is locked, members send change requests per section. Approve (the change is applied) or reject (write a reason).', 'សំណើកែប្រែ', 'Change requests') },
    { route: '/system', el: '#settings', ...T('ការកំណត់៖ ចំនួនថ្ងៃដែលសមាជិកអាចកែប្រែព័ត៌មានក្រោយពេលអនុម័ត ថ្ងៃបន្តសមាជិកភាពប្រចាំឆ្នាំ (PENDING ដោយស្វ័យប្រវត្តិ) អសកម្មដោយស្វ័យប្រវត្តិ និង កម្រិតសមាជិក (ពណ៌កាត)។', 'Settings: how many days members can edit after approval, the yearly renewal date (automatic PENDING), automatic INACTIVE, and member levels (card colours).', 'ការកំណត់', 'Settings') },
    { route: '/system', el: 'a[href="#/association/edit"]', ...T('កែប្រែព័ត៌មានសមាគម ថ្លៃសមាជិកភាព គណនីធនាគារ និង QR។', 'Edit association info, membership fee, bank account and QR.', 'ព័ត៌មានសមាគម', 'Association info') },
    { route: '/events', el: 'a[href="#/events/new"]', ...T('បង្កើតព្រឹត្តិការណ៍ (តម្លៃ ថ្ងៃបិទការចុះឈ្មោះ)។ បើកព្រឹត្តិការណ៍ ដើម្បីមើលអ្នកចូលរួម វិក្កយបត្របង់ប្រាក់ និង នាំចេញជា Excel។', 'Create events (price, registration closing days). Open an event to see who joined, their payment proofs, and export the list to Excel.', 'ព្រឹត្តិការណ៍', 'Events') },
    { el: '[data-tour]', ...T('ចុចប៊ូតុង ? នេះ ពេលណាក៏បាន ដើម្បីមើលការណែនាំម្ដងទៀត។', 'Tap this ? button any time to see this tour again.', 'ជំនួយ', 'Help') },
  ],
};

export function tourKind(user, member) {
  if (user.role === 'admin') return 'admin';
  if (user.role === 'moderator') return 'moderator';
  return ['DRAFT', 'REJECTED'].includes(member?.status) ? 'applicant' : 'member';
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const routeOf = () => location.hash.slice(1).split('?')[0] || '/';

async function waitFor(sel, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = document.querySelector(sel);
    if (el && el.getClientRects().length) return el;
    await sleep(60);
  }
  return null;
}

let running = null;

export async function startTour(kind, onDone) {
  if (running) running.close();
  const steps = STEPS[kind] || STEPS.member;
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = '<div class="tour-spot"></div><div class="tour-tip" role="dialog" aria-live="polite"></div>';
  document.body.append(root);
  const spot = root.querySelector('.tour-spot');
  const tip = root.querySelector('.tour-tip');
  let i = 0;
  let target = null;
  let closed = false;

  const place = () => {
    const vw = innerWidth, vh = innerHeight;
    if (!target) {
      spot.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      tip.style.cssText = `left:${Math.max(12, (vw - tip.offsetWidth) / 2)}px;top:${Math.max(12, (vh - tip.offsetHeight) / 2)}px`;
      return;
    }
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const below = r.bottom + 14;
    const top = below + tip.offsetHeight < vh - 8 ? below : Math.max(8, r.top - 14 - tip.offsetHeight);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - tip.offsetWidth / 2), vw - tip.offsetWidth - 12);
    tip.style.cssText = `left:${left}px;top:${top}px`;
  };

  const close = () => {
    if (closed) return;
    closed = true;
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    removeEventListener('keydown', onKey);
    root.remove();
    running = null;
    onDone?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft' && i > 0) show(i - 1);
  };

  async function show(n) {
    if (n >= steps.length) return close();
    i = n;
    const s = steps[n];
    tip.innerHTML = '<div class="tour-load">…</div>';
    if (s.route && routeOf() !== s.route) location.hash = s.route;
    target = s.el ? await waitFor(s.el) : null;
    if (closed || i !== n) return;
    if (s.el && !target && s.optional) return show(n + 1); // e.g. live clock only on active passes
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    tip.innerHTML = `
      <div class="tour-head"><span class="tour-count">${n + 1} / ${steps.length}</span>
        <button class="tour-x" data-t="skip" aria-label="Close tour">${IC.x}</button></div>
      <h3>${esc(s.titleKh)} <small>${esc(s.titleEn)}</small></h3>
      <p class="kh">${esc(s.kh)}</p><p class="en">${esc(s.en)}</p>
      <div class="tour-nav">
        ${n ? `<button class="btn sm light" data-t="back">${IC.back} ថយ · Back</button>` : '<button class="btn sm light" data-t="skip">រំលង · Skip</button>'}
        <button class="btn sm" data-t="next">${n === steps.length - 1 ? 'រួចរាល់ · Done' : `បន្ទាប់ · Next ${IC.next}`}</button>
      </div>`;
    place();
    requestAnimationFrame(place);
    tip.querySelector('[data-t="next"]').focus();
  }

  tip.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t === 'next') show(i + 1);
    if (t === 'back') show(i - 1);
    if (t === 'skip') close();
  });
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  addEventListener('keydown', onKey);
  running = { close };
  show(0);
}

// Shows the tour automatically the first time a user of each kind signs in on this device.
export function maybeAutoTour(user, member) {
  if (!user || user.must_change || running) return;
  const kind = tourKind(user, member);
  const key = `aisarc_tour_${user.id}_${kind}`;
  try {
    if (localStorage.getItem(key)) return;
    // An applicant who already had the applicant tour gets the member tour once they are approved.
    if (kind === 'member' && member?.status !== 'ACTIVE' && localStorage.getItem(`aisarc_tour_${user.id}_applicant`)) return;
  } catch { return; }
  setTimeout(() => {
    if (running) return;
    try { localStorage.setItem(key, '1'); } catch { /* private mode */ }
    startTour(kind);
  }, 700);
}
