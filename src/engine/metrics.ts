import { correctChars, type KeyEvent, type TypingState } from './typing';

export interface SessionResult {
  wpm: number; rawWpm: number; acc: number; correctChars: number;
  keystrokes: number; maxCombo: number; durationMs: number;
}
export interface KeySample { hits: number; errors: number; intervalSum: number; intervalCount: number }

export const MAX_INTERVAL_MS = 2000;

export const round1 = (x: number): number => Math.round(x * 10) / 10;

export function perMinute(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return chars / 5 / (ms / 60000);
}

export function computeResult(s: TypingState, durationMs: number): SessionResult {
  const cc = correctChars(s);
  const denom = s.keystrokes + s.missed;
  return {
    wpm: round1(perMinute(cc, durationMs)),
    rawWpm: round1(perMinute(s.keystrokes, durationMs)),
    acc: denom === 0 ? 0 : s.correctKeystrokes / denom,
    correctChars: cc,
    keystrokes: s.keystrokes,
    maxCombo: s.maxCombo,
    durationMs,
  };
}

export function keySamples(events: readonly KeyEvent[]): Record<string, KeySample> {
  const out: Record<string, KeySample> = {};
  events.forEach((e, i) => {
    if (e.expected === null || e.expected === ' ') return;
    const k = (out[e.expected] ??= { hits: 0, errors: 0, intervalSum: 0, intervalCount: 0 });
    k.hits++;
    if (!e.correct) k.errors++;
    if (i > 0) {
      const dt = e.t - events[i - 1].t;
      if (dt > 0 && dt <= MAX_INTERVAL_MS) { k.intervalSum += dt; k.intervalCount++; }
    }
  });
  return out;
}
