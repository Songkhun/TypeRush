import { describe, expect, it } from 'vitest';
import { computeResult, keySamples, perMinute } from './metrics';
import { createTyping, typeChar, type TypingState } from './typing';

function play(words: string[], keys: [string, number][]): TypingState {
  let s = createTyping(words);
  for (const [ch, t] of keys) s = typeChar(s, ch, t);
  return s;
}

describe('perMinute', () => {
  it('computes chars/5 per minute and guards zero time', () => {
    expect(perMinute(50, 60000)).toBe(10);
    expect(perMinute(50, 0)).toBe(0);
  });
});

describe('computeResult', () => {
  it('perfect run', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['b', 100], [' ', 200], ['c', 300], ['d', 400]]);
    const r = computeResult(s, 60000);
    expect(r).toMatchObject({ wpm: 1, rawWpm: 1, acc: 1, correctChars: 5, keystrokes: 5, maxCombo: 5 });
  });
  it('run with an error', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['x', 100], [' ', 200], ['c', 300], ['d', 400]]);
    const r = computeResult(s, 60000);
    expect(r.correctChars).toBe(4);
    expect(r.acc).toBeCloseTo(0.6);
  });
  it('all-wrong run has zero WPM and accuracy, never NaN', () => {
    const s = play(['ab'], [['x', 0], ['y', 100]]);
    const r = computeResult(s, 30000);
    expect(r.wpm).toBe(0);
    expect(r.acc).toBe(0);
    const empty = computeResult(createTyping(['ab']), 0);
    expect(Number.isNaN(empty.acc) || Number.isNaN(empty.wpm)).toBe(false);
  });
});

describe('keySamples', () => {
  it('aggregates hits, errors and intervals by expected key', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['x', 100], [' ', 200], ['c', 300], ['d', 2600]]);
    const k = keySamples(s.events);
    expect(k.a).toEqual({ hits: 1, errors: 0, intervalSum: 0, intervalCount: 0 });
    expect(k.b).toEqual({ hits: 1, errors: 1, intervalSum: 100, intervalCount: 1 });
    expect(k.c).toEqual({ hits: 1, errors: 0, intervalSum: 100, intervalCount: 1 });
    expect(k.d).toEqual({ hits: 1, errors: 0, intervalSum: 0, intervalCount: 0 }); // 2300ms gap ignored
    expect(k[' ']).toBeUndefined();
  });
});
