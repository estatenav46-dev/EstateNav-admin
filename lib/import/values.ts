import { BLANK_VALUES } from './spec';

// Cell parsing for the bulk import. Brochures and cost sheets write the same thing many ways
// ("1.02 Cr", "₹1,02,00,000", "58.56 Lakhs Onwards", "1273-1498", "March 2022 (RTMI)"), and AI
// tools copy those spellings, so every reader here is forgiving and returns null when unsure.

export type Raw = string | number | boolean | Date | null;

export const clean = (value: Raw): string => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).replace(/ /g, ' ').trim();
  return BLANK_VALUES.has(text.toLowerCase()) ? '' : text;
};

export const isBlank = (value: Raw) => clean(value) === '';

const UNIT_MULTIPLIER: [RegExp, number][] = [
  [/^(cr|crs|crore|crores)$/i, 10_000_000],
  [/^(l|lac|lacs|lakh|lakhs|lk)$/i, 100_000],
  [/^(k|thousand)$/i, 1_000],
];

/**
 * Rupees from "1.5 Cr", "85 L", "₹ 90,87,300", "1,03,35000", "58.56 Lakhs Onwards", 15000000.
 * Returns every amount found, so "1.2 – 1.6 Cr" gives both ends (the unit applies to both).
 */
export function moneyList(value: Raw): number[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
  const text = clean(value)
    .replace(/₹|\brs\.?|\binr\b|\/-|onwards|approx\.?|\*|\+?\s*gst.*$/gi, ' ')
    .replace(/(\d),(?=\d)/g, '$1');
  const matches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(cr(?:ores?|s)?|crore|l(?:a(?:c|kh)s?|akhs?|k)?|thousand|k)?\b/gi));
  if (!matches.length) return [];
  // A unit written once at the end ("1.2 - 1.6 Cr") applies to every number before it.
  const trailing = [...matches].reverse().find((m) => m[2])?.[2] ?? '';
  return matches
    .map((m) => {
      const n = Number(m[1]);
      const unit = m[2] || trailing;
      const mult = UNIT_MULTIPLIER.find(([re]) => re.test(unit))?.[1] ?? 1;
      return Math.round(n * mult * 100) / 100;
    })
    .filter((n) => Number.isFinite(n));
}

export const money = (value: Raw): number | null => moneyList(value)[0] ?? null;

/** Plain number: "80%", "4.13 acres", "2,477". */
export function num(value: Raw): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = clean(value).replace(/(\d),(?=\d)/g, '$1');
  const m = text.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function int(value: Raw): number | null {
  const n = num(value);
  return n == null || n <= 0 ? null : Math.round(n);
}

const SQM_TO_SQFT = 10.7639;

/**
 * Areas in sq.ft. "1273-1498" → [1273, 1498]; "878, 881 & 883" → [878, 883]; "30*40" or
 * "30 x 40" (feet) → [1200]; "111.5 sq.m" → [1200]. Returns [min, max] with max null for one size.
 */
export function areaRange(value: Raw): [number | null, number | null] {
  if (typeof value === 'number') return [value > 0 ? Math.round(value) : null, null];
  const text = clean(value).toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
  if (!text) return [null, null];
  const dims = text.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?$/);
  if (dims) return [Math.round(Number(dims[1]) * Number(dims[2])), null];
  const sqm = /sq\.?\s*m\b|sqm|m2|m²/.test(text) && !/sq\.?\s*ft|sft|sqft/.test(text);
  const numbers = Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((m) => Number(m[0]) * (sqm ? SQM_TO_SQFT : 1)).filter((n) => n > 0);
  if (!numbers.length) return [null, null];
  const min = Math.round(Math.min(...numbers));
  const max = Math.round(Math.max(...numbers));
  return [min, max > min ? max : null];
}

export const bool = (value: Raw): boolean | null => {
  if (typeof value === 'boolean') return value;
  const text = clean(value).toLowerCase();
  if (!text) return null;
  if (['yes', 'y', 'true', '1', '✓', '✔', 'x'].includes(text)) return true;
  if (['no', 'n', 'false', '0'].includes(text)) return false;
  return null;
};

/** Items separated by "|" or new lines (commas are kept: amenity names contain them). */
export const list = (value: Raw): string[] =>
  clean(value)
    .split(/\s*(?:\||\r?\n|•|·|;)\s*/)
    .map((item) => item.replace(/^[-–*○o]\s+/, '').trim())
    .filter((item) => item && !BLANK_VALUES.has(item.toLowerCase()));

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110)
    .replace(/-+$/g, '');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A date from ISO strings, Excel dates and serials, "Dec 2030", "December-2030", "12/2030",
 * "Q4 2030", "2030" or "March 2022 (RTMI)". Returns the ISO date and whether only the year was known.
 */
export function dateValue(value: Raw): { iso: string; precision: 'day' | 'month' | 'year' } | null {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : { iso: value.toISOString().slice(0, 10), precision: 'day' };
  if (typeof value === 'number') {
    if (value > 20000 && value < 80000) {
      // Excel serial day number.
      const d = new Date(Math.round((value - 25569) * 86400 * 1000));
      return { iso: d.toISOString().slice(0, 10), precision: 'day' };
    }
    if (value >= 1990 && value <= 2100) return { iso: `${value}-12-01`, precision: 'year' };
    return null;
  }
  const text = clean(value).toLowerCase();
  if (!text) return null;
  let m = text.match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return { iso: `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3] ?? 1))}`, precision: m[3] ? 'day' : 'month' };
  m = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return { iso: `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`, precision: 'day' }; // Indian DD/MM/YYYY
  m = text.match(/\b(\d{1,2})[/.-](\d{4})\b/);
  if (m && Number(m[1]) <= 12) return { iso: `${m[2]}-${pad(Number(m[1]))}-01`, precision: 'month' };
  m = text.match(/\bq([1-4])\s*[-' ]?\s*(\d{4}|\d{2})\b/);
  if (m) {
    const year = m[2].length === 2 ? `20${m[2]}` : m[2];
    return { iso: `${year}-${pad(Number(m[1]) * 3)}-01`, precision: 'month' };
  }
  const monthIndex = MONTHS.findIndex((mon) => new RegExp(`\\b${mon}`).test(text));
  m = text.match(/\b(20\d{2}|19\d{2})\b/) ?? text.match(/['’-](\d{2})\b/);
  if (monthIndex >= 0 && m) {
    const year = m[1].length === 2 ? `20${m[1]}` : m[1];
    return { iso: `${year}-${pad(monthIndex + 1)}-01`, precision: 'month' };
  }
  m = text.match(/\b(20\d{2})\b/);
  if (m) return { iso: `${m[1]}-12-01`, precision: 'year' };
  return null;
}

/** "Jun 2031" style label for a possession date. */
export function monthLabel(iso: string, precision: 'day' | 'month' | 'year' = 'month'): string {
  const [y, mo] = iso.split('-').map(Number);
  if (precision === 'year') return String(y);
  return `${MONTHS[(mo || 1) - 1].replace(/^./, (c) => c.toUpperCase())} ${y}`;
}

/** Latitude/longitude from a Google Maps link (…@12.9,77.6…, ?q=12.9,77.6, !3d12.9!4d77.6). */
export function coordsFromMapsLink(url: string): { lat: number; lng: number } | null {
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export const isUrl = (input: string) => /^https?:\/\/\S+$/i.test(input.trim());

/** Normalises a word for enum matching: "Under Construction" → "under-construction". */
export const enumKey = (input: string) => input.trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9.+-]/g, '');

/** Bengaluru check for the city column (and the address/PIN when the city is blank). */
const BENGALURU_WORDS = /bengal[uo]ru|bangalore|\bblr\b|devanahalli|hoskote|nelamangala|bidadi|anekal|sarjapura?|attibele|yelahanka|whitefield|electronic city|kanakapura|hennur|budigere|chandapura|jigani|doddaballapura?|rajanukunte|bagalur/i;

export function isBengaluru(city: string, address = '', pincode = ''): boolean | null {
  if (city) return BENGALURU_WORDS.test(city);
  const pin = (pincode || address.match(/\b(5[67]\d{4})\b/)?.[1] || '').trim();
  if (/^56[0-2]\d{3}$/.test(pin)) return true;
  if (BENGALURU_WORDS.test(address)) return true;
  return null; // unknown
}
