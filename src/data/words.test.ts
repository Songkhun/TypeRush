import { describe, expect, it } from 'vitest';
import { WORDS } from './words';
import { keyFor } from '../engine/keyboard';

describe('word lists', () => {
  it('have enough unique words', () => {
    expect(WORDS.en.length).toBeGreaterThanOrEqual(400);
    expect(WORDS.th.length).toBeGreaterThanOrEqual(250);
    for (const lang of ['en', 'th'] as const) expect(new Set(WORDS[lang]).size).toBe(WORDS[lang].length);
  });
  it('English words are lowercase a-z only', () => {
    for (const w of WORDS.en) expect(w).toMatch(/^[a-z]+$/);
  });
  it('every character is typeable on its layout and words have no spaces', () => {
    for (const lang of ['en', 'th'] as const) {
      for (const w of WORDS[lang]) {
        expect(w).not.toMatch(/\s/);
        for (const ch of w) expect(keyFor(lang, ch), `${lang} "${w}" char "${ch}"`).not.toBeNull();
      }
    }
  });
});
