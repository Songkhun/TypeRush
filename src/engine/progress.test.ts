import { describe, expect, it } from 'vitest';
import {
  accMultiplier, activeTimeMs, arcadeXp, computeStreak, dateKey, levelInfo, sessionXp, xpForNext,
} from './progress';

describe('XP', () => {
  it('accuracy multiplier edges', () => {
    expect(accMultiplier(0.79)).toBe(0);
    expect(accMultiplier(0.8)).toBe(0.5);
    expect(accMultiplier(0.95)).toBe(1.25);
    expect(accMultiplier(1)).toBe(1.5);
  });
  it('session XP adds combo bonus', () => {
    expect(sessionXp(100, 1, 0)).toBe(150);
    expect(sessionXp(100, 1, 50)).toBe(160);
    expect(sessionXp(100, 0.5, 30)).toBe(5);
    expect(sessionXp(0, 0, 0)).toBe(0);
  });
  it('arcade XP', () => {
    expect(arcadeXp(1234)).toBe(123);
  });
});

describe('levels', () => {
  it('thresholds', () => {
    expect(xpForNext(1)).toBe(100);
    expect(xpForNext(2)).toBe(283);
    expect(levelInfo(0)).toEqual({ level: 1, intoLevel: 0, needed: 100 });
    expect(levelInfo(99)).toEqual({ level: 1, intoLevel: 99, needed: 100 });
    expect(levelInfo(100)).toEqual({ level: 2, intoLevel: 0, needed: 283 });
    expect(levelInfo(383)).toEqual({ level: 3, intoLevel: 0, needed: 520 });
  });
});

describe('time and streak', () => {
  it('dateKey is local and zero-padded', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('active time skips gaps over 5s', () => {
    expect(activeTimeMs([0, 1000, 2000, 9000, 9500])).toBe(2500);
    expect(activeTimeMs([])).toBe(0);
  });
  const goal = 300000;
  const today = new Date(2026, 9, 7, 12);
  const met = { activeMs: goal };
  it('counts consecutive days including today', () => {
    expect(computeStreak({ '2026-10-05': met, '2026-10-06': met, '2026-10-07': met }, goal, today)).toBe(3);
  });
  it('counts from yesterday when today is not done yet', () => {
    expect(computeStreak({ '2026-10-05': met, '2026-10-06': met, '2026-10-07': { activeMs: 10 } }, goal, today)).toBe(2);
  });
  it('resets after a missed day', () => {
    expect(computeStreak({ '2026-10-04': met, '2026-10-06': met }, goal, today)).toBe(1);
    expect(computeStreak({ '2026-10-04': met }, goal, today)).toBe(0);
  });
  it('crosses month boundaries', () => {
    expect(computeStreak({ '2026-09-30': met, '2026-10-01': met }, goal, new Date(2026, 9, 1))).toBe(2);
  });
});
