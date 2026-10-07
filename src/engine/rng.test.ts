import { describe, expect, it } from 'vitest';
import { mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = [a(), a(), a()], ys = [b(), b(), b()];
    expect(xs).toEqual(ys);
  });
  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 50; i++) expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c'], r));
  });
});
