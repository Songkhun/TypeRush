export function accMultiplier(acc: number): number {
  if (acc < 0.8) return 0;
  return Math.round((0.5 + (Math.min(acc, 1) - 0.8) / 0.2) * 1000) / 1000;
}

export function sessionXp(correctChars: number, acc: number, maxCombo: number): number {
  return Math.round(correctChars * accMultiplier(acc) + 5 * Math.floor(maxCombo / 25));
}

export function arcadeXp(score: number): number {
  return Math.floor(score / 10);
}

export function xpForNext(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

export function levelInfo(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let rem = totalXp;
  while (rem >= xpForNext(level)) { rem -= xpForNext(level); level++; }
  return { level, intoLevel: rem, needed: xpForNext(level) };
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const ACTIVE_GAP_MS = 5000;

export function activeTimeMs(times: readonly number[], gapMs = ACTIVE_GAP_MS): number {
  let sum = 0;
  for (let i = 1; i < times.length; i++) {
    const dt = times[i] - times[i - 1];
    if (dt > 0 && dt <= gapMs) sum += dt;
  }
  return sum;
}

export function computeStreak(daily: Record<string, { activeMs: number }>, goalMs: number, today: Date): number {
  const met = (d: Date) => (daily[dateKey(d)]?.activeMs ?? 0) >= goalMs;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!met(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (met(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
