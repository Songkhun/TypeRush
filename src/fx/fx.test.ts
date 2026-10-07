import { describe, expect, it } from 'vitest';
import { burst, particleCount, stepParticles } from './particles';
import { comboTier } from './combo';
import { effectiveIntensity } from './motion';
import { mulberry32 } from '../engine/rng';

describe('particles', () => {
  it('bursts the requested number at the origin', () => {
    const ps = burst(10, 20, 5, '#fff', mulberry32(1));
    expect(ps).toHaveLength(5);
    for (const p of ps) expect([p.x, p.y]).toEqual([10, 20]);
  });
  it('moves and expires particles', () => {
    const [p] = burst(0, 0, 1, '#fff', mulberry32(1));
    const [moved] = stepParticles([p], 0.1);
    expect(moved.x).toBeCloseTo(p.vx * 0.1);
    expect(stepParticles([p], 5)).toHaveLength(0);
  });
  it('applies gravity', () => {
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, color: '#fff', size: 2 };
    expect(stepParticles([p], 0.5, 100)[0].vy).toBe(50);
  });
  it('scales counts by intensity', () => {
    expect(particleCount(30, 'off')).toBe(0);
    expect(particleCount(30, 'subtle')).toBe(10);
    expect(particleCount(30, 'full')).toBe(30);
  });
});

describe('comboTier', () => {
  it('maps thresholds', () => {
    expect([0, 9, 10, 24, 25, 50, 99, 100, 500].map(comboTier)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
  });
});

describe('effectiveIntensity', () => {
  it('reduced motion forces off', () => {
    expect(effectiveIntensity('full', true)).toBe('off');
    expect(effectiveIntensity('subtle', false)).toBe('subtle');
  });
});
