import type { Rng } from './rng';

function pushNoRepeat(out: string[], list: readonly string[], idx: number): void {
  let w = list[idx];
  if (list.length > 1 && w === out[out.length - 1]) w = list[(idx + 1) % list.length];
  out.push(w);
}

export function randomWords(list: readonly string[], n: number, rng: Rng): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) pushNoRepeat(out, list, Math.floor(rng() * list.length));
  return out;
}

export function wordWeight(word: string, weakness: Record<string, number>): number {
  let sum = 0;
  for (const ch of word) sum += weakness[ch] ?? 0;
  return sum;
}

function pickWeighted(weights: number[], total: number, rng: Rng): number {
  let r = rng() * total;
  let lastPositive = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    lastPositive = i;
    r -= weights[i];
    if (r < 0) return i;
  }
  return lastPositive;
}

export function weightedWords(
  list: readonly string[], n: number, weakness: Record<string, number>, rng: Rng, weakShare = 0.7,
): string[] {
  const weights = list.map((w) => wordWeight(w, weakness));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return randomWords(list, n, rng);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = rng() < weakShare ? pickWeighted(weights, total, rng) : Math.floor(rng() * list.length);
    pushNoRepeat(out, list, idx);
  }
  return out;
}
