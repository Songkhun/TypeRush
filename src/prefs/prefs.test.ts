import { describe, expect, it } from 'vitest';
import { BG, contrastRatio, paletteFor, THEME_IDS, THEMES } from './themes';
import { FONT_IDS, FONT_SIZE, fontFor, FONTS } from './fonts';

describe('themes', () => {
  it('has five themes with complete hex palettes', () => {
    expect(THEME_IDS).toEqual(['neon', 'matrix', 'sunset', 'ocean', 'mono']);
    for (const id of THEME_IDS) {
      for (const v of Object.values(THEMES[id].palette)) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('neon keeps the original colors', () => {
    expect(THEMES.neon.palette).toMatchObject({ correct: '#22d3ee', error: '#f472b6', combo: '#fbbf24' });
  });
  it('every theme stays readable on the dark background', () => {
    for (const id of THEME_IDS) {
      const p = THEMES[id].palette;
      for (const c of [p.correct, p.error, p.combo, p.text]) expect(contrastRatio(c, BG), `${id} ${c}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.muted, BG), `${id} muted`).toBeGreaterThanOrEqual(3);
    }
  });
  it('contrastRatio matches known values', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1);
  });
  it('falls back to neon for unknown ids', () => {
    expect(paletteFor('pink' as never)).toBe(THEMES.neon.palette);
  });
});

describe('fonts', () => {
  it('pairs every font with a Thai font in its stack', () => {
    expect(FONT_IDS).toEqual(['jetbrains', 'fira', 'roboto', 'sarabun', 'kanit']);
    for (const id of FONT_IDS) {
      const f = FONTS[id];
      expect(f.latin.length).toBeGreaterThan(0);
      expect(f.thai.length).toBeGreaterThan(0);
      expect(f.stack).toContain(`"${f.latin}"`);
      expect(f.stack).toContain(`"${f.thai}"`);
    }
  });
  it('falls back to JetBrains Mono for unknown ids', () => {
    expect(fontFor('comic' as never)).toBe(FONTS.jetbrains);
  });
  it('defines a sane size range', () => {
    expect(FONT_SIZE.min).toBeLessThan(FONT_SIZE.default);
    expect(FONT_SIZE.default).toBeLessThan(FONT_SIZE.max);
  });
});
