import { describe, expect, it } from 'vitest';
import { defaultData, load, save, STORAGE_KEY, type KV } from './storage';

function fake(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const kv: KV = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
  return { kv, m };
}

describe('storage', () => {
  it('returns defaults when empty', () => {
    expect(load(fake().kv)).toEqual(defaultData());
  });
  it('round-trips', () => {
    const { kv } = fake();
    const d = { ...defaultData(), xp: 42 };
    expect(save(d, kv)).toBe(true);
    expect(load(kv).xp).toBe(42);
  });
  it('backs up corrupt JSON and starts fresh', () => {
    const { kv, m } = fake({ [STORAGE_KEY]: '{not json' });
    expect(load(kv, 123)).toEqual(defaultData());
    expect(m.get('typingapp:corrupt:123')).toBe('{not json');
  });
  it('backs up wrong-shape data', () => {
    const { kv, m } = fake({ [STORAGE_KEY]: JSON.stringify({ version: 1, xp: 'lots' }) });
    expect(load(kv, 5)).toEqual(defaultData());
    expect(m.has('typingapp:corrupt:5')).toBe(true);
  });
  it('fills missing settings from defaults', () => {
    const d = defaultData() as unknown as Record<string, unknown>;
    const { kv } = fake({ [STORAGE_KEY]: JSON.stringify({ ...d, settings: { sound: false } }) });
    const loaded = load(kv);
    expect(loaded.settings.sound).toBe(false);
    expect(loaded.settings.dailyGoalMin).toBe(5);
  });
  it('survives storage that throws', () => {
    const bad: KV = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(load(bad)).toEqual(defaultData());
    expect(save(defaultData(), bad)).toBe(false);
    expect(load(null)).toEqual(defaultData());
  });
  it('sanitizes invalid setting values instead of crashing', () => {
    const d = defaultData() as unknown as Record<string, unknown>;
    const bad = {
      language: 'fr', dailyGoalMin: 0, volume: 5, theme: 'pink', font: 'comic', soundPack: 'kazoo',
      fxIntensity: 'max', fontSize: 99, sound: 'yes', showKeyboard: null,
    };
    const { kv } = fake({ [STORAGE_KEY]: JSON.stringify({ ...d, settings: bad }) });
    const s = load(kv).settings;
    const def = defaultData().settings;
    expect(s).toMatchObject({
      language: 'en', dailyGoalMin: 1, volume: 1, theme: 'neon', font: 'jetbrains', soundPack: def.soundPack,
      fxIntensity: 'full', sound: true, showKeyboard: true,
    });
    expect(s.fontSize).toBeLessThanOrEqual(2.4);
    const { kv: kv2 } = fake({ [STORAGE_KEY]: JSON.stringify({ ...d, settings: { dailyGoalMin: 999, volume: -1 } }) });
    expect(load(kv2).settings).toMatchObject({ dailyGoalMin: 120, volume: 0 });
  });
  it('defaults the new customization settings', () => {
    expect(defaultData().settings).toMatchObject({ soundPack: 'retro', volume: 0.8, theme: 'neon', font: 'jetbrains', fontSize: 1.6 });
  });
});

