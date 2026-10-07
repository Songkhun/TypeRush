import { clickVoices, soundPack, type SoundPackId, type Voice } from './soundPacks';

/** Tiny Web Audio synth: no audio files. All methods are no-ops when disabled or unsupported. */
export class Sound {
  enabled = true;
  volume = 0.8;
  pack: SoundPackId = 'retro';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private out(): { ac: AudioContext; master: GainNode } | null {
    if (!this.enabled || this.volume <= 0) return null;
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master!.gain.value = this.volume;
    return { ac: this.ctx, master: this.master! };
  }

  private noiseBuffer(ac: AudioContext): AudioBuffer {
    if (!this.noise) {
      this.noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private play(v: Voice, delay = 0): void {
    const o = this.out();
    if (!o) return;
    const { ac, master } = o;
    const t = ac.currentTime + delay;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(v.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
    gain.connect(master);
    if (v.wave === 'noise') {
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuffer(ac);
      const filter = ac.createBiquadFilter();
      filter.type = v.filter ?? 'lowpass';
      filter.frequency.value = v.freq;
      src.connect(filter).connect(gain);
      src.start(t, Math.random() * 0.5, v.dur + 0.02);
    } else {
      const osc = ac.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.freq, t);
      if (v.endFreq) osc.frequency.exponentialRampToValueAtTime(v.endFreq, t + v.dur);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + v.dur + 0.02);
    }
  }

  click(combo: number, delay = 0): void { for (const v of clickVoices(this.pack, combo)) this.play(v, delay); }
  error(): void { for (const v of soundPack(this.pack).error) this.play(v); }
  laser(): void { this.play({ wave: 'square', freq: 1400, endFreq: 300, dur: 0.08, vol: 0.025 }); }

  fanfare(): void {
    const f = soundPack(this.pack).fanfare;
    f.notes.forEach((freq, i) => this.play({ wave: f.wave, freq, dur: f.dur, vol: f.vol }, i * f.step));
  }

  levelUp(): void {
    const f = soundPack(this.pack).fanfare;
    const notes = [...f.notes, f.notes[f.notes.length - 1] * 1.26, f.notes[f.notes.length - 1] * 1.5];
    notes.forEach((freq, i) => this.play({ wave: f.wave, freq, dur: f.dur, vol: f.vol }, i * f.step * 0.7));
  }

  explosion(): void { this.play({ wave: 'noise', freq: 900, dur: 0.3, vol: 0.25, filter: 'lowpass' }); }

  /** A few keystrokes with a rising combo, then an error: lets the user hear a pack. */
  preview(): void {
    [0, 8, 16, 24, 32].forEach((combo, i) => this.click(combo, i * 0.11));
    window.setTimeout(() => this.error(), 650);
  }
}
