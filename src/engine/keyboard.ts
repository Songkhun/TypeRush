export type Lang = 'en' | 'th';

export interface KeyCap { id: string; base: string; shifted: string; width?: number }
export interface KeyPos { id: string; shift: boolean }

const EN = {
  base: ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'],
  shifted: ['~!@#$%^&*()_+', 'QWERTYUIOP{}|', 'ASDFGHJKL:"', 'ZXCVBNM<>?'],
};

// Thai Kedmanee (TIS 820-2538), same physical positions as EN above.
const TH = {
  base: ['_ๅ/-ภถุึคตจขช', 'ๆไำพะัีรนยบลฃ', 'ฟหกดเ้่าสวง', 'ผปแอิืทมใฝ'],
  shifted: ['%+๑๒๓๔ู฿๕๖๗๘๙', '๐"ฎฑธํ๊ณฯญฐ,ฅ', 'ฤฆฏโฌ็๋ษศซ.', '()ฉฮฺ์?ฒฬฦ'],
};

function buildRows(lang: Lang): KeyCap[][] {
  const src = lang === 'en' ? EN : TH;
  const rows: KeyCap[][] = src.base.map((row, r) => {
    const base = [...row];
    const shifted = [...src.shifted[r]];
    const ids = [...EN.base[r]];
    return base.map((b, i) => ({ id: ids[i], base: b, shifted: shifted[i] }));
  });
  rows.push([{ id: 'space', base: ' ', shifted: ' ', width: 6 }]);
  return rows;
}

const ROWS: Record<Lang, KeyCap[][]> = { en: buildRows('en'), th: buildRows('th') };

function buildIndex(rows: KeyCap[][]): Map<string, KeyPos> {
  const m = new Map<string, KeyPos>();
  for (const row of rows) {
    for (const cap of row) {
      if (!m.has(cap.base)) m.set(cap.base, { id: cap.id, shift: false });
      if (!m.has(cap.shifted)) m.set(cap.shifted, { id: cap.id, shift: true });
    }
  }
  return m;
}

const INDEX: Record<Lang, Map<string, KeyPos>> = { en: buildIndex(ROWS.en), th: buildIndex(ROWS.th) };

export function layoutRows(lang: Lang): KeyCap[][] {
  return ROWS[lang];
}

export function keyFor(lang: Lang, ch: string): KeyPos | null {
  return INDEX[lang].get(ch) ?? null;
}

export function scriptOf(ch: string): Lang | null {
  if (/[฀-๿]/.test(ch)) return 'th';
  if (/[A-Za-z]/.test(ch)) return 'en';
  return null;
}
