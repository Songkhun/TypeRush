import type { Rng } from '../engine/rng';
import type { FxIntensity } from '../store/storage';

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export function burst(x: number, y: number, count: number, color: string, rng: Rng = Math.random, speed = 220): Particle[] {
  return Array.from({ length: count }, () => {
    const a = rng() * Math.PI * 2;
    const v = speed * (0.3 + rng() * 0.7);
    const life = 0.5 + rng() * 0.5;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, color, size: 2 + rng() * 3 };
  });
}

export function stepParticles(ps: Particle[], dt: number, gravity = 0): Particle[] {
  const out: Particle[] = [];
  for (const p of ps) {
    const life = p.life - dt;
    if (life <= 0) continue;
    out.push({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + gravity * dt, life });
  }
  return out;
}

export function particleCount(base: number, intensity: FxIntensity): number {
  if (intensity === 'off') return 0;
  return intensity === 'subtle' ? Math.ceil(base / 3) : base;
}

export function drawParticles(g: CanvasRenderingContext2D, ps: readonly Particle[]): void {
  for (const p of ps) {
    g.globalAlpha = Math.max(0, p.life / p.maxLife);
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
}
