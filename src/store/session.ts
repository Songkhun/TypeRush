import type { Lang } from '../engine/keyboard';
import { updateKeyStats } from '../engine/keystats';
import { round1, type KeySample, type SessionResult } from '../engine/metrics';
import { arcadeXp, dateKey, levelInfo, sessionXp } from '../engine/progress';
import { MAX_SESSIONS, type Mode, type SaveData, type SessionRecord } from './storage';

export interface Outcome { data: SaveData; xpGained: number; personalBest: boolean; levelBefore: number; levelAfter: number }

export interface TypingSessionInput {
  mode: 'test' | 'drill'; lang: Lang; result: SessionResult;
  samples: Record<string, KeySample>; activeMs: number; now: Date;
}
export interface ArcadeSessionInput {
  lang: Lang; score: number; wpm: number; acc: number; durationMs: number; activeMs: number; now: Date;
}

export function bestWpm(data: SaveData, mode: Mode, lang: Lang): number {
  let best = 0;
  for (const s of data.sessions) if (s.mode === mode && s.lang === lang && s.wpm > best) best = s.wpm;
  return best;
}

function addCommon(data: SaveData, rec: SessionRecord, activeMs: number, now: Date): SaveData {
  const key = dateKey(now);
  return {
    ...data,
    xp: data.xp + rec.xp,
    sessions: [...data.sessions, rec].slice(-MAX_SESSIONS),
    daily: { ...data.daily, [key]: { activeMs: (data.daily[key]?.activeMs ?? 0) + activeMs } },
  };
}

export function applyTypingSession(data: SaveData, input: TypingSessionInput): Outcome {
  const levelBefore = levelInfo(data.xp).level;
  const { mode, lang, result, samples, activeMs, now } = input;
  if (result.keystrokes === 0) return { data, xpGained: 0, personalBest: false, levelBefore, levelAfter: levelBefore };
  const xp = sessionXp(result.correctChars, result.acc, result.maxCombo);
  const personalBest = result.wpm > 0 && result.wpm > bestWpm(data, mode, lang);
  const rec: SessionRecord = {
    ts: now.getTime(), mode, lang, durationMs: result.durationMs,
    wpm: result.wpm, rawWpm: result.rawWpm, acc: result.acc, xp,
  };
  const withSession = addCommon(data, rec, activeMs, now);
  const next: SaveData = {
    ...withSession,
    keyStats: { ...data.keyStats, [lang]: updateKeyStats(data.keyStats[lang], samples) },
  };
  return { data: next, xpGained: xp, personalBest, levelBefore, levelAfter: levelInfo(next.xp).level };
}

export function applyArcadeSession(data: SaveData, input: ArcadeSessionInput): Outcome & { highScore: boolean } {
  const levelBefore = levelInfo(data.xp).level;
  const { lang, score, wpm, acc, durationMs, activeMs, now } = input;
  if (score === 0 && activeMs <= 0) {
    return { data, xpGained: 0, personalBest: false, highScore: false, levelBefore, levelAfter: levelBefore };
  }
  const xp = arcadeXp(score);
  const highScore = score > data.arcadeHigh[lang];
  const rec: SessionRecord = {
    ts: now.getTime(), mode: 'arcade', lang, durationMs, wpm: round1(wpm), rawWpm: round1(wpm), acc, xp,
  };
  const withSession = addCommon(data, rec, activeMs, now);
  const next: SaveData = {
    ...withSession,
    arcadeHigh: { ...data.arcadeHigh, [lang]: Math.max(data.arcadeHigh[lang], score) },
  };
  return { data: next, xpGained: xp, personalBest: highScore, highScore, levelBefore, levelAfter: levelInfo(next.xp).level };
}
