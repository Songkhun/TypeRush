/** Tiny Web Audio synth: no audio files. All methods are no-ops when disabled or unsupported. */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, endFreq?: number): void {
    const ac = this.ac();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  click(combo: number): void { this.tone(420 + Math.min(combo, 100) * 6, 0.05, 'triangle', 0.05); }
  error(): void { this.tone(120, 0.12, 'sawtooth', 0.04, 0, 70); }
  laser(): void { this.tone(1400, 0.08, 'square', 0.025, 0, 300); }
  fanfare(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.04, i * 0.1)); }
  levelUp(): void { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, i * 0.06)); }

  explosion(): void {
    const ac = this.ac();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * 0.3);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = 0.15;
    src.connect(gain).connect(ac.destination);
    src.start();
  }
}
