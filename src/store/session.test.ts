import { describe, expect, it } from 'vitest';
import { applyArcadeSession, applyTypingSession, bestWpm } from './session';
import { defaultData, MAX_SESSIONS } from './storage';
import { sessionXp } from '../engine/progress';
import type { SessionResult } from '../engine/metrics';

const now = new Date(2026, 9, 7, 10);
const result = (over: Partial<SessionResult> = {}): SessionResult => ({
  wpm: 50, rawWpm: 55, acc: 0.9, correctChars: 250, keystrokes: 270, maxCombo: 30, durationMs: 30000, ...over,
});
const samples = { a: { hits: 12, errors: 2, intervalSum: 1200, intervalCount: 12 } };
const input = (over: Partial<SessionResult> = {}) =>
  ({ mode: 'test' as const, lang: 'en' as const, result: result(over), samples, activeMs: 25000, now });

describe('applyTypingSession', () => {
  it('records session, XP, daily time and key stats', () => {
    const out = applyTypingSession(defaultData(), input());
    const xp = sessionXp(250, 0.9, 30);
    expect(out.xpGained).toBe(xp);
    expect(out.data.xp).toBe(xp);
    expect(out.data.sessions).toHaveLength(1);
    expect(out.data.sessions[0]).toMatchObject({ mode: 'test', lang: 'en', wpm: 50, xp });
    expect(out.data.daily['2026-10-07'].activeMs).toBe(25000);
    expect(out.data.keyStats.en.a.hits).toBe(12);
    expect(out.data.keyStats.th).toEqual({});
  });
  it('flags personal bests per mode and language', () => {
    const first = applyTypingSession(defaultData(), input());
    expect(first.personalBest).toBe(true);
    const slower = applyTypingSession(first.data, input({ wpm: 40 }));
    expect(slower.personalBest).toBe(false);
    const faster = applyTypingSession(slower.data, input({ wpm: 60 }));
    expect(faster.personalBest).toBe(true);
    expect(bestWpm(faster.data, 'test', 'en')).toBe(60);
    expect(bestWpm(faster.data, 'test', 'th')).toBe(0);
  });
  it('reports level-ups', () => {
    const out = applyTypingSession(defaultData(), input({ correctChars: 200, acc: 1 }));
    expect(out.levelBefore).toBe(1);
    expect(out.levelAfter).toBe(2);
  });
  it('ignores sessions with no keystrokes', () => {
    const d = defaultData();
    const out = applyTypingSession(d, input({ keystrokes: 0, correctChars: 0, wpm: 0, acc: 0 }));
    expect(out.data).toBe(d);
    expect(out.xpGained).toBe(0);
  });
  it('gives zero XP for an all-wrong session', () => {
    const out = applyTypingSession(defaultData(), input({ correctChars: 0, acc: 0, wpm: 0, maxCombo: 0 }));
    expect(out.xpGained).toBe(0);
    expect(out.personalBest).toBe(false);
  });
  it('caps stored sessions', () => {
    const d = defaultData();
    d.sessions = Array.from({ length: MAX_SESSIONS }, (_, i) => ({
      ts: i, mode: 'test' as const, lang: 'en' as const, durationMs: 1, wpm: 1, rawWpm: 1, acc: 1, xp: 0,
    }));
    const out = applyTypingSession(d, input());
    expect(out.data.sessions).toHaveLength(MAX_SESSIONS);
    expect(out.data.sessions[0].ts).toBe(1);
  });
});

describe('applyArcadeSession', () => {
  const a = { lang: 'th' as const, score: 1500, wpm: 33.33, acc: 0.9, durationMs: 90000, activeMs: 60000, now };
  it('records high score and XP', () => {
    const out = applyArcadeSession(defaultData(), a);
    expect(out.highScore).toBe(true);
    expect(out.xpGained).toBe(150);
    expect(out.data.arcadeHigh.th).toBe(1500);
    expect(out.data.sessions[0]).toMatchObject({ mode: 'arcade', lang: 'th', wpm: 33.3 });
    const again = applyArcadeSession(out.data, { ...a, score: 100 });
    expect(again.highScore).toBe(false);
    expect(again.data.arcadeHigh.th).toBe(1500);
  });
  it('ignores an untouched game', () => {
    const d = defaultData();
    expect(applyArcadeSession(d, { ...a, score: 0, activeMs: 0 }).data).toBe(d);
  });
});
