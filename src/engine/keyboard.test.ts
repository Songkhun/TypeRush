import { describe, expect, it } from 'vitest';
import { keyFor, layoutRows, scriptOf } from './keyboard';

describe('layouts', () => {
  it('EN and TH rows have matching shapes', () => {
    const en = layoutRows('en'), th = layoutRows('th');
    expect(th.length).toBe(5);
    th.forEach((row, r) => expect(row.length).toBe(en[r].length));
  });
  it('has no duplicate characters within a layout', () => {
    for (const lang of ['en', 'th'] as const) {
      const all = layoutRows(lang).slice(0, 4).flat().flatMap((k) => [k.base, k.shifted]);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe('keyFor', () => {
  it('maps English base and shifted', () => {
    expect(keyFor('en', 'a')).toEqual({ id: 'a', shift: false });
    expect(keyFor('en', 'A')).toEqual({ id: 'a', shift: true });
    expect(keyFor('en', ';')).toEqual({ id: ';', shift: false });
  });
  it('maps Thai Kedmanee', () => {
    expect(keyFor('th', 'ก')).toEqual({ id: 'd', shift: false });
    expect(keyFor('th', 'ฎ')).toEqual({ id: 'e', shift: true });
    expect(keyFor('th', '่')).toEqual({ id: 'j', shift: false });
    expect(keyFor('th', 'ำ')).toEqual({ id: 'e', shift: false });
    expect(keyFor('th', 'ฃ')).toEqual({ id: '\\', shift: false });
  });
  it('maps space and rejects foreign chars', () => {
    expect(keyFor('th', ' ')).toEqual({ id: 'space', shift: false });
    expect(keyFor('th', 'a')).toBeNull();
    expect(keyFor('en', 'ก')).toBeNull();
  });
});

describe('scriptOf', () => {
  it('detects scripts', () => {
    expect(scriptOf('ก')).toBe('th');
    expect(scriptOf('้')).toBe('th');
    expect(scriptOf('Z')).toBe('en');
    expect(scriptOf(' ')).toBeNull();
    expect(scriptOf('5')).toBeNull();
  });
});
