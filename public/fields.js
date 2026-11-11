// Member fields, mapped to the columns of the Google Form responses sheet.
// col: column index in the xlsx; edit: 'member' = member may edit, 'admin' = admin only.
export const SECTIONS = [
  { id: 'personal', kh: 'ព័ត៌មានផ្ទាល់ខ្លួន', en: 'Personal' },
  { id: 'contact', kh: 'ទំនាក់ទំនង', en: 'Contact' },
  { id: 'work', kh: 'ការងារ និង ការសិក្សា', en: 'Work & Education' },
  { id: 'reg', kh: 'ការចុះបញ្ជិកា និង ឯកសារ', en: 'Registration & Documents' },
  { id: 'membership', kh: 'សមាជិកភាព', en: 'Membership' },
];

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
  { key: 'experience', col: 21, section: 'work', kh: 'បទពិសោធន៍ការងារ (ឆ្នាំ)', en: 'Work experience (years)' },

  { key: 'cnc_reg_date', col: 22, section: 'reg', kh: 'ថ្ងៃចុះបញ្ជិកាជាមួយគណៈគិលានុបដ្ឋាកជាតិ', en: 'Cambodian Council of Nurses reg. date', placeholder: 'DD/MM/YYYY' },
  { key: 'cnc_reg_no', col: 23, section: 'reg', kh: 'លេខបញ្ជិកា', en: 'Registration no.' },
  { key: 'cert_file', col: 24, section: 'reg', kh: 'វិញ្ញាបនបត្រសមាជិក គណៈគិលានុបដ្ឋាក', en: 'Council membership certificate', type: 'file', accept: 'image/*,application/pdf' },
  { key: 'photo', col: 25, section: 'reg', kh: 'រូបថត 4x6', en: 'Photo 4x6', type: 'photo' },

  { key: 'email', col: 1, section: 'membership', kh: 'អ៊ីម៉ែល (ចូលប្រើ Google)', en: 'Email (Google sign-in)', edit: 'admin', type: 'email' },
  { key: 'joined_at', col: 0, section: 'membership', kh: 'ថ្ងៃចូលជាសមាជិក', en: 'Member since', edit: 'admin', type: 'datetime' },
  { key: 'member_no', section: 'membership', kh: 'លេខសមាជិក', en: 'Membership no.', edit: 'admin' },
  { key: 'status', section: 'membership', kh: 'ស្ថានភាព', en: 'Status', edit: 'admin', type: 'select', options: ['ACTIVE', 'PENDING', 'INACTIVE'] },
  { key: 'payment', col: 28, section: 'membership', kh: 'ការបង់ប្រាក់វិភាគទាន', en: 'Membership fee payment', edit: 'admin' },
  { key: 'consent', col: 29, section: 'membership', kh: 'ការយល់ព្រម', en: 'Declaration consent', edit: 'admin' },
];

export const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const canEdit = (f, role) => role === 'admin' || (f.edit || 'member') === 'member';
