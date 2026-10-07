import type { Lang } from '../engine/keyboard';
import type { KeyStat } from '../engine/keystats';
import { SOUND_PACK_IDS, type SoundPackId } from '../fx/soundPacks';
import { FONT_IDS, FONT_SIZE, type FontId } from '../prefs/fonts';
import { THEME_IDS, type ThemeId } from '../prefs/themes';

export type FxIntensity = 'off' | 'subtle' | 'full';
export type Mode = 'test' | 'drill' | 'arcade';

export interface Settings {
  sound: boolean; fxIntensity: FxIntensity; dailyGoalMin: number; showKeyboard: boolean; language: Lang;
  soundPack: SoundPackId; volume: number; theme: ThemeId; font: FontId; fontSize: number;
}
export interface SessionRecord {
  ts: number; mode: Mode; lang: Lang; durationMs: number; wpm: number; rawWpm: number; acc: number; xp: number;
}
export interface SaveData {
  version: 1;
  settings: Settings;
  xp: number;
  sessions: SessionRecord[];
  keyStats: Record<Lang, Record<string, KeyStat>>;
  daily: Record<string, { activeMs: number }>;
  arcadeHigh: Record<Lang, number>;
}
export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export const STORAGE_KEY = 'typingapp:v1';
export const MAX_SESSIONS = 1000;

export function defaultData(): SaveData {
  return {
    version: 1,
    settings: {
      sound: true, fxIntensity: 'full', dailyGoalMin: 5, showKeyboard: true, language: 'en',
      soundPack: 'retro', volume: 0.8, theme: 'neon', font: 'jetbrains', fontSize: FONT_SIZE.default,
    },
    xp: 0,
    sessions: [],
    keyStats: { en: {}, th: {} },
    daily: {},
    arcadeHigh: { en: 0, th: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const clampNum = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Saved settings with every unknown or out-of-range value replaced by a safe one. */
export function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const d = defaultData().settings;
  return {
    sound: bool(raw.sound, d.sound),
    fxIntensity: oneOf(raw.fxIntensity, ['off', 'subtle', 'full'], d.fxIntensity),
    dailyGoalMin: Math.round(clampNum(raw.dailyGoalMin, 1, 120, d.dailyGoalMin)),
    showKeyboard: bool(raw.showKeyboard, d.showKeyboard),
    language: oneOf(raw.language, ['en', 'th'], d.language),
    soundPack: oneOf(raw.soundPack, SOUND_PACK_IDS, d.soundPack),
    volume: clampNum(raw.volume, 0, 1, d.volume),
    theme: oneOf(raw.theme, THEME_IDS, d.theme),
    font: oneOf(raw.font, FONT_IDS, d.font),
    fontSize: clampNum(raw.fontSize, FONT_SIZE.min, FONT_SIZE.max, d.fontSize),
  };
}

export function migrate(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  if (typeof raw.xp !== 'number' || !Array.isArray(raw.sessions)) return null;
  if (!isObj(raw.settings) || !isObj(raw.keyStats) || !isObj(raw.daily) || !isObj(raw.arcadeHigh)) return null;
  const d = defaultData();
  return {
    ...d,
    ...(raw as Partial<SaveData>),
    settings: sanitizeSettings(raw.settings),
    keyStats: { ...d.keyStats, ...(raw.keyStats as Partial<SaveData['keyStats']>) },
    arcadeHigh: { ...d.arcadeHigh, ...(raw.arcadeHigh as Partial<SaveData['arcadeHigh']>) },
  };
}

export function load(storage: KV | null, now = Date.now()): SaveData {
  let raw: string | null;
  try {
    raw = storage ? storage.getItem(STORAGE_KEY) : null;
  } catch {
    return defaultData();
  }
  if (raw === null) return defaultData();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  const data = migrate(parsed);
  if (data) return data;
  try { storage?.setItem(`typingapp:corrupt:${now}`, raw); } catch { /* best effort */ }
  return defaultData();
}

export function save(data: SaveData, storage: KV | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getStorage(): KV | null {
  try { return window.localStorage; } catch { return null; }
}
