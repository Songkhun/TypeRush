export type FontId = 'jetbrains' | 'fira' | 'roboto' | 'sarabun' | 'kanit';

export interface FontChoice { name: string; latin: string; thai: string; stack: string }

const font = (name: string, latin: string, thai: string): FontChoice =>
  ({ name, latin, thai, stack: `"${latin}", "${thai}", ui-monospace, monospace` });

export const FONT_IDS: FontId[] = ['jetbrains', 'fira', 'roboto', 'sarabun', 'kanit'];

/** Each Latin font is paired with a Thai font so Thai text never falls back to a mismatched system font. */
export const FONTS: Record<FontId, FontChoice> = {
  jetbrains: font('JetBrains Mono', 'JetBrains Mono', 'Noto Sans Thai'),
  fira: font('Fira Code', 'Fira Code', 'IBM Plex Sans Thai'),
  roboto: font('Roboto Mono', 'Roboto Mono', 'Noto Sans Thai Looped'),
  sarabun: font('Sarabun', 'Sarabun', 'Sarabun'),
  kanit: font('Kanit', 'Kanit', 'Kanit'),
};

/** Typing-text size in rem. */
export const FONT_SIZE = { min: 1.2, max: 2.4, step: 0.1, default: 1.6 };

export function fontFor(id: FontId): FontChoice {
  return FONTS[id] ?? FONTS.jetbrains;
}
