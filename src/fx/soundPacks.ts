export type SoundPackId = 'mechanical' | 'typewriter' | 'pop' | 'retro';

/** One synthesized layer. For `noise`, `freq` is the filter cutoff. */
export interface Voice {
  wave: OscillatorType | 'noise';
  freq: number;
  endFreq?: number;
  dur: number;
  vol: number;
  filter?: 'lowpass' | 'highpass';
}

export interface SoundPack {
  name: string;
  click: Voice[];
  /** Hz added per combo step (combo capped at 100). */
  comboPitch: number;
  error: Voice[];
  fanfare: { wave: OscillatorType; notes: number[]; step: number; dur: number; vol: number };
}

export const SOUND_PACK_IDS: SoundPackId[] = ['mechanical', 'typewriter', 'pop', 'retro'];

export const SOUND_PACKS: Record<SoundPackId, SoundPack> = {
  mechanical: {
    name: 'Mechanical',
    click: [
      { wave: 'noise', freq: 1800, dur: 0.045, vol: 0.18, filter: 'lowpass' },
      { wave: 'triangle', freq: 140, endFreq: 90, dur: 0.06, vol: 0.12 },
    ],
    comboPitch: 1.5,
    error: [{ wave: 'noise', freq: 500, dur: 0.12, vol: 0.2, filter: 'lowpass' }],
    fanfare: { wave: 'triangle', notes: [392, 523, 659, 784], step: 0.09, dur: 0.16, vol: 0.06 },
  },
  typewriter: {
    name: 'Typewriter',
    click: [
      { wave: 'noise', freq: 2500, dur: 0.03, vol: 0.2, filter: 'highpass' },
      { wave: 'square', freq: 1800, endFreq: 900, dur: 0.02, vol: 0.03 },
    ],
    comboPitch: 4,
    error: [{ wave: 'square', freq: 180, endFreq: 120, dur: 0.1, vol: 0.04 }],
    fanfare: { wave: 'sine', notes: [1568, 2093, 2637], step: 0.12, dur: 0.5, vol: 0.08 },
  },
  pop: {
    name: 'Soft pop',
    click: [{ wave: 'sine', freq: 600, endFreq: 300, dur: 0.07, vol: 0.12 }],
    comboPitch: 5,
    error: [{ wave: 'sine', freq: 220, endFreq: 140, dur: 0.15, vol: 0.12 }],
    fanfare: { wave: 'sine', notes: [523, 659, 784, 1047], step: 0.1, dur: 0.2, vol: 0.08 },
  },
  retro: {
    name: 'Retro arcade',
    click: [{ wave: 'triangle', freq: 420, dur: 0.05, vol: 0.05 }],
    comboPitch: 6,
    error: [{ wave: 'sawtooth', freq: 120, endFreq: 70, dur: 0.12, vol: 0.04 }],
    fanfare: { wave: 'square', notes: [523, 659, 784, 1047], step: 0.1, dur: 0.18, vol: 0.04 },
  },
};

export function soundPack(id: SoundPackId): SoundPack {
  return SOUND_PACKS[id] ?? SOUND_PACKS.retro;
}

export function clickVoices(id: SoundPackId, combo: number): Voice[] {
  const p = soundPack(id);
  const up = Math.min(Math.max(combo, 0), 100) * p.comboPitch;
  return p.click.map((v) => ({ ...v, freq: v.freq + up, endFreq: v.endFreq === undefined ? undefined : v.endFreq + up }));
}
