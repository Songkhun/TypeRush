import { describe, expect, it } from 'vitest';
import { clickVoices, SOUND_PACK_IDS, SOUND_PACKS, soundPack } from './soundPacks';

describe('sound packs', () => {
  it('has four complete packs', () => {
    expect(SOUND_PACK_IDS).toEqual(['mechanical', 'typewriter', 'pop', 'retro']);
    for (const id of SOUND_PACK_IDS) {
      const p = SOUND_PACKS[id];
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.click.length).toBeGreaterThan(0);
      expect(p.error.length).toBeGreaterThan(0);
      expect(p.fanfare.notes.length).toBeGreaterThanOrEqual(3);
      for (const v of [...p.click, ...p.error]) expect(v.vol).toBeLessThanOrEqual(0.25);
    }
  });
  it('raises click pitch with combo, capped at 100', () => {
    for (const id of SOUND_PACK_IDS) {
      const base = clickVoices(id, 0)[0].freq;
      expect(clickVoices(id, 50)[0].freq).toBeGreaterThan(base);
      expect(clickVoices(id, 500)).toEqual(clickVoices(id, 100));
    }
  });
  it('falls back to retro for unknown ids', () => {
    expect(soundPack('kazoo' as never)).toBe(SOUND_PACKS.retro);
  });
});
