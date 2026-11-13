// Cambodian provinces + capital (25). Value stored = Khmer name; label shows Khmer · English.
// `alt` are spellings found in free text (old Google Form answers) used to map them to a province.
export const PROVINCES = [
  { kh: 'ភ្នំពេញ', en: 'Phnom Penh', alt: ['phnom penh', 'phnompenh', 'p.penh', 'pp'] },
  { kh: 'បន្ទាយមានជ័យ', en: 'Banteay Meanchey', alt: ['banteay meanchey', 'banteay mean chey', 'banteaymeanchey', 'b.meanchey', 'poipet', 'ប៉ោយប៉ែត', 'សិរីសោភ័ណ', 'serei saophoan', 'sisophon'] },
  { kh: 'បាត់ដំបង', en: 'Battambang', alt: ['battambang', 'battam bang', 'batdambang', 'bat dambang'] },
  { kh: 'កំពង់ចាម', en: 'Kampong Cham', alt: ['kampong cham', 'kompong cham', 'kampongcham', 'kg cham', 'k.cham'] },
  { kh: 'កំពង់ឆ្នាំង', en: 'Kampong Chhnang', alt: ['kampong chhnang', 'kompong chhnang', 'kampong chnang', 'kampongchhnang', 'kg chhnang', 'កំពង់ឆ្នាំ'] },
  { kh: 'កំពង់ស្ពឺ', en: 'Kampong Speu', alt: ['kampong speu', 'kompong speu', 'kampongspeu', 'kg speu'] },
  { kh: 'កំពង់ធំ', en: 'Kampong Thom', alt: ['kampong thom', 'kompong thom', 'kampongthom', 'kg thom'] },
  { kh: 'កំពត', en: 'Kampot', alt: ['kampot', 'kompot'] },
  { kh: 'កណ្តាល', en: 'Kandal', alt: ['kandal', 'កណ្ដាល', 'តាខ្មៅ', 'ta khmau', 'takhmao', 'takhmau'] },
  { kh: 'កែប', en: 'Kep', alt: ['kep', 'kaeb'] },
  { kh: 'កោះកុង', en: 'Koh Kong', alt: ['koh kong', 'kohkong', 'kaoh kong'] },
  { kh: 'ក្រចេះ', en: 'Kratie', alt: ['kratie', 'kratié', 'kracheh'] },
  { kh: 'មណ្ឌលគិរី', en: 'Mondulkiri', alt: ['mondulkiri', 'mondul kiri', 'mondolkiri', 'mondol kiri', 'mondulkiry'] },
  { kh: 'ឧត្តរមានជ័យ', en: 'Oddar Meanchey', alt: ['oddar meanchey', 'oddar mean chey', 'otdar meanchey', 'oddarmeanchey'] },
  { kh: 'ប៉ៃលិន', en: 'Pailin', alt: ['pailin', 'pai lin'] },
  { kh: 'ព្រះសីហនុ', en: 'Preah Sihanouk', alt: ['preah sihanouk', 'sihanouk', 'sihanoukville', 'kampong som', 'kompong som', 'កំពង់សោម'] },
  { kh: 'ព្រះវិហារ', en: 'Preah Vihear', alt: ['preah vihear', 'preahvihear', 'preah vihea'] },
  { kh: 'ព្រៃវែង', en: 'Prey Veng', alt: ['prey veng', 'preyveng'] },
  { kh: 'ពោធិ៍សាត់', en: 'Pursat', alt: ['pursat', 'pousat', 'posat', 'ពោធិសាត់', 'ពោធិ៏សាត់'] },
  { kh: 'រតនគិរី', en: 'Ratanakiri', alt: ['ratanakiri', 'rattanakiri', 'ratanak kiri', 'ratanakkiri', 'rotanakiri', 'banlung'] },
  { kh: 'សៀមរាប', en: 'Siem Reap', alt: ['siem reap', 'siemreap', 'siem riep'] },
  { kh: 'ស្ទឹងត្រែង', en: 'Stung Treng', alt: ['stung treng', 'stungtreng', 'stoeng treng', 'steung treng'] },
  { kh: 'ស្វាយរៀង', en: 'Svay Rieng', alt: ['svay rieng', 'svayrieng', 'svay rien'] },
  { kh: 'តាកែវ', en: 'Takeo', alt: ['takeo', 'takev', 'ta keo'] },
  { kh: 'ត្បូងឃ្មុំ', en: 'Tbong Khmum', alt: ['tbong khmum', 'tboung khmum', 'tbaung khmum', 'tbong khmom', 'tboung khmom', 'suong', 'សួង'] },
];

// Normalise text for matching: lower case, no zero-width characters, the two Khmer "da/ta" subscripts unified.
const norm = (s) => String(s || '').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\u17d2\u178a/g, '\u17d2\u178f').replace(/\s+/g, ' ').trim();

// The province mentioned in a free-text address, or '' when none or more than one is mentioned.
// Khmer addresses are written from village up to province, so when several match the LAST mention wins
// only if it is clearly marked as the province ("ខេត្ត" / "រាជធានី" / "province" / "city").
export function provinceOf(text) {
  const t = norm(text);
  if (!t) return '';
  const exact = PROVINCES.find((p) => norm(p.kh) === t || norm(p.en) === t);
  if (exact) return exact.kh;
  const hits = [];
  for (const p of PROVINCES) {
    for (const name of [p.kh, p.en, ...p.alt]) {
      const n = norm(name);
      const latin = /^[a-z .]+$/.test(n);
      const re = latin ? new RegExp(`(^|[^a-z])${n.replace(/[.]/g, '\\.').replace(/ /g, '\\s*')}($|[^a-z])`) : null;
      const idx = latin ? (re.exec(t)?.index ?? -1) : t.indexOf(n);
      if (idx >= 0) { hits.push({ p, idx }); break; }
    }
  }
  if (hits.length === 1) return hits[0].p.kh;
  if (hits.length > 1) {
    const marked = hits.filter(({ p }) => [p.kh, p.en, ...p.alt].some((n) => new RegExp(`(ខេត្ត|រាជធានី|ក្រុង)\\s*${norm(n)}|${norm(n)}\\s*(province|city|capital)`).test(t)));
    if (marked.length === 1) return marked[0].p.kh;
    // Otherwise the last one mentioned (addresses go from village up to province).
    return hits.reduce((a, b) => (b.idx > a.idx ? b : a)).p.kh;
  }
  return '';
}
