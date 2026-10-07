import { describe, expect, it } from 'vitest';
import { errorRates, sessionWeakness, updateKeyStats, weakKeys, weaknessMap } from './keystats';

const samples = {
  a: { hits: 10, errors: 5, intervalSum: 1000, intervalCount: 10 },
  b: { hits: 10, errors: 0, intervalSum: 3000, intervalCount: 10 },
};

describe('sessionWeakness', () => {
  it('combines error rate and relative slowness', () => {
    const w = sessionWeakness(samples);
    expect(w.a).toBeCloseTo(0.35); // 0.7*0.5 + 0.3*0
    expect(w.b).toBeCloseTo(0.15); // 0.7*0 + 0.3*0.5
  });
});

describe('updateKeyStats', () => {
  it('initialises from the first session', () => {
    const st = updateKeyStats({}, samples);
    expect(st.a).toEqual({ hits: 10, errors: 5, score: expect.closeTo(0.35) });
  });
  it('applies an exponential moving average', () => {
    const prev = { a: { hits: 10, errors: 5, score: 0.35 } };
    const st = updateKeyStats(prev, { a: { hits: 10, errors: 0, intervalSum: 1000, intervalCount: 10 } });
    expect(st.a.score).toBeCloseTo(0.315);
    expect(st.a.hits).toBe(20);
  });
});

describe('weaknessMap / weakKeys / errorRates', () => {
  const stats = {
    a: { hits: 20, errors: 8, score: 0.4 },
    b: { hits: 20, errors: 1, score: 0.1 },
    c: { hits: 5, errors: 5, score: 0.9 }, // too few hits
    d: { hits: 30, errors: 0, score: 0 },
  };
  it('excludes low-hit and zero-score keys', () => {
    expect(weaknessMap(stats)).toEqual({ a: 0.4, b: 0.1 });
  });
  it('orders weak keys by score', () => {
    expect(weakKeys(stats, 5)).toEqual(['a', 'b']);
    expect(weakKeys({}, 5)).toEqual([]);
  });
  it('reports error rates for keys with enough hits', () => {
    expect(errorRates(stats)).toEqual({ a: 0.4, b: 0.05, d: 0 });
  });
});
