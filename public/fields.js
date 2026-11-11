// Shared definitions used by both the server and the browser.

export const STATUSES = [
  { key: 'REVIEW', kh: 'កំពុងពិនិត្យ', en: 'Waiting for review', color: 'orange' },
  { key: 'PENDING', kh: 'ផុតកំណត់', en: 'Expired – renewal needed', color: 'grey' },
  { key: 'ACTIVE', kh: 'សកម្ម', en: 'Active', color: 'green' },
  { key: 'REJECTED', kh: 'បានបដិសេធ', en: 'Rejected', color: 'red' },
  { key: 'INACTIVE', kh: 'អសកម្ម', en: 'Inactive', color: 'red' },
];
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

export const ROLES = [
  { key: 'member', en: 'Member' },
  { key: 'moderator', en: 'Moderator (approve / reject)' },
  { key: 'admin', en: 'Admin (full access)' },
];

export const CONSENT_YES = 'យល់ព្រម';
export const CONSENT_NO = 'មិនយល់ព្រម';
export const DECLARATION = 'បើមានព័ត៌មានមិនពិតណាមួយទាក់ទងនឹងការបំពេញពាក្យចូលជាសមាជិក សមាគម គិលានុបដ្ឋាកឯកទេសដាក់ថ្នាំសណ្តំ និង ប្រពោធនកម្មកម្ពុជា នោះអ្នកនឹងត្រូវបានលុបឈ្មោះជាសមាជិកចេញពីសមាគម ហើយថវិកាបង់ថ្លៃសមាជិកភាពរបស់អ្នកនឹងមិនត្រូវបានប្រគល់ជូនវិញនោះទេ។ ខ្ញុំយល់ព្រមឱ្យសមាគមរក្សាទុក និងប្រើប្រាស់ព័ត៌មានរបស់ខ្ញុំសម្រាប់គោលបំណងសមាជិកភាព។';

export const REJECT_REASONS = [
  { key: 'missing', kh: 'ព័ត៌មានមិនទាន់គ្រប់គ្រាន់ សូមបំពេញបន្ថែម', en: 'Some information is missing – please complete it' },
  { key: 'incorrect', kh: 'ព័ត៌មានមិនត្រឹមត្រូវ សូមកែតម្រូវ', en: 'Some information is incorrect – please correct it' },
  { key: 'other', kh: 'មូលហេតុផ្សេងៗ', en: 'Other reason' },
];

// Association info: edited by admin, shown to everyone in the Association tab.
export const ASSOC_FIELDS = [
  { key: 'name_kh', kh: 'ឈ្មោះសមាគម', en: 'Association name (Khmer)' },
  { key: 'name_en', kh: 'ឈ្មោះជាអក្សរឡាតាំង', en: 'Association name (Latin)' },
  { key: 'about', kh: 'អំពីសមាគម', en: 'About', type: 'textarea' },
  { key: 'fee', kh: 'ថ្លៃសមាជិកភាព', en: 'Membership fee', placeholder: 'e.g. $10 / year' },
  { key: 'term_months', kh: 'រយៈពេលសុពលភាព', en: 'Membership validity (0 = never expires)', type: 'number', unit: 'ខែ' },
  { key: 'bank_name', kh: 'ធនាគារ', en: 'Bank' },
  { key: 'account_name', kh: 'ឈ្មោះគណនី', en: 'Account name' },
  { key: 'account_no', kh: 'លេខគណនី', en: 'Account number' },
  { key: 'currency', kh: 'រូបិយប័ណ្ណ', en: 'Currency' },
  { key: 'payment_note', kh: 'ការណែនាំការបង់ប្រាក់', en: 'Payment instructions', type: 'textarea' },
  { key: 'qr', kh: 'QR សម្រាប់បង់ប្រាក់', en: 'Payment QR (KHQR)', type: 'photo' },
  { key: 'phone', kh: 'លេខទូរស័ព្ទទំនាក់ទំនង', en: 'Contact phone', type: 'tel' },
  { key: 'telegram', kh: 'តេលេក្រាម', en: 'Telegram' },
  { key: 'email', kh: 'អ៊ីម៉ែល', en: 'Email' },
  { key: 'address', kh: 'អាសយដ្ឋាន', en: 'Address', type: 'textarea' },
];

export const SECTIONS = [
  { id: 'personal', kh: 'ព័ត៌មានផ្ទាល់ខ្លួន', en: 'Personal' },
  { id: 'contact', kh: 'ទំនាក់ទំនង', en: 'Contact' },
  { id: 'work', kh: 'ការងារ និង ការសិក្សា', en: 'Work & Education' },
  { id: 'reg', kh: 'ការចុះបញ្ជិកា និង ឯកសារ', en: 'Registration & Documents' },
  { id: 'membership', kh: 'សមាជិកភាព', en: 'Membership' },
];

// col: column index in the Google Form xlsx; edit: 'admin' = only admin may change it.
export const FIELDS = [
  { key: 'name_kh', col: 3, section: 'personal', kh: 'គោត្តនាម និង នាមខ្លួន', en: 'Full name (Khmer)', required: true },
  { key: 'name_en', col: 4, section: 'personal', kh: 'ឈ្មោះជាអក្សរឡាតាំង', en: 'Full name (Latin)', required: true, upper: true },
  { key: 'gender', col: 5, section: 'personal', kh: 'ភេទ', en: 'Gender', type: 'select', options: ['ប្រុស', 'ស្រី'] },
  { key: 'nationality', col: 6, section: 'personal', kh: 'សញ្ជាតិ', en: 'Nationality', list: ['ខ្មែរ'] },
  { key: 'dob', col: 7, section: 'personal', kh: 'ថ្ងៃខែឆ្នាំកំណើត', en: 'Date of birth', placeholder: 'DD/MM/YYYY' },
  { key: 'age_group', col: 8, section: 'personal', kh: 'អាយុ', en: 'Age group', type: 'select', options: ['២០ - ៣០ឆ្នាំ', '៣០ - ៤០ឆ្នាំ', '៤០ - ៥០ឆ្នាំ', '៥០ - ៦០ឆ្នាំ', '៦០ឆ្នាំ ឡើង'] },
  { key: 'birthplace', col: 9, section: 'personal', kh: 'ទីកន្លែងកំណើត', en: 'Place of birth', type: 'textarea' },
  { key: 'address', col: 10, section: 'personal', kh: 'អាស័យដ្ឋានបច្ចុប្បន្ន', en: 'Current address', type: 'textarea' },
  { key: 'tshirt', col: 11, section: 'personal', kh: 'ទំហំអាវយឺត', en: 'T-shirt size', type: 'select', options: ['S', 'M', 'L', 'XL', 'XXL'] },

  { key: 'phone', col: 12, section: 'contact', kh: 'លេខទូរស័ព្ទ', en: 'Phone', type: 'tel' },
  { key: 'telegram', col: 27, section: 'contact', kh: 'លេខទូរស័ព្ទតេលេក្រាម', en: 'Telegram phone', type: 'tel' },
  { key: 'contact_email', col: 26, section: 'contact', kh: 'អ៊ីម៉ែល ឬ ហ្វេសបុក ផ្លូវការ', en: 'Official email / Facebook' },

  { key: 'occupation', col: 13, section: 'work', kh: 'មុខរបរ', en: 'Occupation' },
  { key: 'training', col: 14, section: 'work', kh: 'កំរិតបណ្តុះបណ្តាល ជំនាញបច្ចេកទេស', en: 'Technical training' },
  { key: 'highest_degree', col: 15, section: 'work', kh: 'កំរិតសញ្ញាបត្រជំនាញខ្ពស់បំផុត', en: 'Highest professional degree', list: ['មធ្យម/បរិញ្ញាបត្ររង', 'បរិញ្ញាបត្រ', 'អនុបណ្ឌិត', 'បណ្ឌិត'] },
  { key: 'general_education', col: 16, section: 'work', kh: 'កំរិតវប្បធម៌ចំណេះទូទៅ', en: 'General education', list: ['មធ្យមសិក្សាទុតិយភូមិ', 'បរិញ្ញាបត្រ'] },
  { key: 'other_degree', col: 17, section: 'work', kh: 'កំរិតសញ្ញាបត្រជំនាញផ្សេងៗ', en: 'Other qualifications' },
  { key: 'workplace', col: 18, section: 'work', kh: 'អង្គភាពបំរើការងារ (ស្រុក ខេត្ត)', en: 'Workplace (district, province)', type: 'textarea' },
  { key: 'department', col: 19, section: 'work', kh: 'ផ្នែក', en: 'Department' },
  { key: 'employment', col: 20, section: 'work', kh: 'សកម្មភាពផ្ទាល់ខ្លួន', en: 'Employment sector', type: 'select', options: ['បំរើការងាររដ្ឋ', 'បំរើការងារឯកជន', 'បំរើការងារ អង្គការ'] },
  { key: 'experience', col: 21, section: 'work', kh: 'បទពិសោធន៍ការងារ', en: 'Work experience', type: 'number', unit: 'ឆ្នាំ' },

  { key: 'cnc_reg_date', col: 22, section: 'reg', kh: 'ថ្ងៃចុះបញ្ជិកាជាមួយគណៈគិលានុបដ្ឋាកជាតិ', en: 'Cambodian Council of Nurses reg. date', placeholder: 'DD/MM/YYYY' },
  { key: 'cnc_reg_no', col: 23, section: 'reg', kh: 'លេខបញ្ជិកា', en: 'Registration no.' },
  { key: 'cert_file', col: 24, section: 'reg', kh: 'វិញ្ញាបនបត្រសមាជិក គណៈគិលានុបដ្ឋាក', en: 'Council membership certificate', type: 'file', accept: 'image/*,application/pdf' },
  { key: 'photo', col: 25, section: 'reg', kh: 'រូបថត 4x6', en: 'Photo 4x6', type: 'photo' },

  { key: 'email', col: 1, section: 'membership', kh: 'អ៊ីម៉ែល (ចូលប្រើ Google)', en: 'Email (Google sign-in)', type: 'email' },
  { key: 'joined_at', col: 0, section: 'membership', kh: 'ថ្ងៃចូលជាសមាជិក', en: 'Member since', edit: 'admin', type: 'datetime' },
  { key: 'member_no', section: 'membership', kh: 'លេខសមាជិក', en: 'Membership no.', edit: 'admin' },
  { key: 'status', section: 'membership', kh: 'ស្ថានភាព', en: 'Status', edit: 'admin', type: 'select', options: STATUSES.map((s) => s.key) },
  { key: 'expires_at', section: 'membership', kh: 'សុពលភាពដល់', en: 'Valid until', edit: 'admin', type: 'datetime' },
  { key: 'consent', col: 29, section: 'membership', kh: 'ការយល់ព្រមលើសេចក្តីប្រកាស', en: 'Declaration consent', type: 'select',
    options: [CONSENT_YES, CONSENT_NO], labels: { [CONSENT_YES]: 'យល់ព្រម · Agree', [CONSENT_NO]: 'មិនយល់ព្រម · Not agree' } },
];

export const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
// Only admins and the member themself can edit; moderators have read-only access.
export const canEdit = (f, role) => role === 'admin' || (role === 'member' && (f.edit || 'member') === 'member');
