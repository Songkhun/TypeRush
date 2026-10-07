import type { Lang } from '../engine/keyboard';
import type { KeyStat } from '../engine/keystats';

export type FxIntensity = 'off' | 'subtle' | 'full';
export type Mode = 'test' | 'drill' | 'arcade';

export interface Settings {
  sound: boolean; fxIntensity: FxIntensity; dailyGoalMin: number; showKeyboard: boolean; language: Lang;
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
    settings: { sound: true, fxIntensity: 'full', dailyGoalMin: 5, showKeyboard: true, language: 'en' },
    xp: 0,
    sessions: [],
    keyStats: { en: {}, th: {} },
    daily: {},
    arcadeHigh: { en: 0, th: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function migrate(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  if (typeof raw.xp !== 'number' || !Array.isArray(raw.sessions)) return null;
  if (!isObj(raw.settings) || !isObj(raw.keyStats) || !isObj(raw.daily) || !isObj(raw.arcadeHigh)) return null;
  const d = defaultData();
  return {
    ...d,
    ...(raw as Partial<SaveData>),
    settings: { ...d.settings, ...(raw.settings as Partial<Settings>) },
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
