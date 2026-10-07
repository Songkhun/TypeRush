import type { KeySample } from './metrics';

export interface KeyStat { hits: number; errors: number; score: number }

export const MIN_HITS = 10;
export const EMA_ALPHA = 0.1;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function sessionWeakness(samples: Record<string, KeySample>): Record<string, number> {
  let sum = 0, count = 0;
  for (const s of Object.values(samples)) { sum += s.intervalSum; count += s.intervalCount; }
  const overall = count ? sum / count : 0;
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(samples)) {
    const errRate = s.hits ? s.errors / s.hits : 0;
    const mean = s.intervalCount ? s.intervalSum / s.intervalCount : overall;
    const slow = overall > 0 ? clamp(mean / overall - 1, 0, 1) : 0;
    out[k] = 0.7 * errRate + 0.3 * slow;
  }
  return out;
}

export function updateKeyStats(
  prev: Record<string, KeyStat>, samples: Record<string, KeySample>, alpha = EMA_ALPHA,
): Record<string, KeyStat> {
  const w = sessionWeakness(samples);
  const next = { ...prev };
  for (const [k, s] of Object.entries(samples)) {
    const p = prev[k];
    next[k] = {
      hits: (p?.hits ?? 0) + s.hits,
      errors: (p?.errors ?? 0) + s.errors,
      score: p ? p.score + alpha * (w[k] - p.score) : w[k],
    };
  }
  return next;
}

export function weaknessMap(stats: Record<string, KeyStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(stats)) if (s.hits >= MIN_HITS && s.score > 0) out[k] = s.score;
  return out;
}

export function weakKeys(stats: Record<string, KeyStat>, n = 5): string[] {
  return Object.entries(weaknessMap(stats)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export function errorRates(stats: Record<string, KeyStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(stats)) if (s.hits >= MIN_HITS) out[k] = s.errors / s.hits;
  return out;
}
