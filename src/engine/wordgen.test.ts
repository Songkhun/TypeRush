import { describe, expect, it } from 'vitest';
import { randomWords, weightedWords, wordWeight } from './wordgen';
import { mulberry32 } from './rng';

const LIST = ['zoo', 'zip', 'zap', 'cat', 'dog', 'pen', 'sun', 'map', 'cup', 'hat'];

describe('randomWords', () => {
  it('is deterministic with a seed and has the right length', () => {
    expect(randomWords(LIST, 20, mulberry32(5))).toEqual(randomWords(LIST, 20, mulberry32(5)));
    expect(randomWords(LIST, 20, mulberry32(5))).toHaveLength(20);
  });
  it('never repeats a word back to back', () => {
    const ws = randomWords(['a', 'b'], 200, mulberry32(9));
    for (let i = 1; i < ws.length; i++) expect(ws[i]).not.toBe(ws[i - 1]);
  });
});

describe('weightedWords', () => {
  it('sums weakness of characters', () => {
    expect(wordWeight('zoo', { z: 0.5, o: 0.1 })).toBeCloseTo(0.7);
  });
  it('favours words with weak keys (~0.7 + 0.3 × 3/10, uniform would be 0.3)', () => {
    const ws = weightedWords(LIST, 2000, { z: 1 }, mulberry32(11));
    const share = ws.filter((w) => w.startsWith('z')).length / ws.length;
    expect(share).toBeGreaterThan(0.65);
    expect(share).toBeLessThan(0.85);
  });
  it('falls back to uniform words when there is no weakness data', () => {
    const ws = weightedWords(LIST, 50, {}, mulberry32(2));
    expect(ws).toHaveLength(50);
    expect(new Set(ws).size).toBeGreaterThan(3);
  });
});
