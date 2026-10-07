import { drawParticles, stepParticles, type Particle } from '../fx/particles';
import type { Palette } from '../prefs/themes';
import { HEIGHT, SHIP, WIDTH, type Enemy, type GameState } from './arcade';

export interface View {
  particles: Particle[];
  lasers: { x: number; y: number; life: number }[];
  banner: { text: string; sub: string; life: number } | null;
  shake: number;
  stars: { x: number; y: number; s: number }[];
}

export const LASER_LIFE = 0.12;
/** Colors and font the canvas draws with, taken from the user's theme and font settings. */
export interface Look { palette: Palette; font: string }

const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export function createView(): View {
  return {
    particles: [], lasers: [], banner: null, shake: 0,
    stars: Array.from({ length: 80 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: 1 + Math.random() * 2 })),
  };
}

export function updateView(v: View, dt: number): void {
  v.particles = stepParticles(v.particles, dt);
  v.lasers = v.lasers.map((l) => ({ ...l, life: l.life - dt })).filter((l) => l.life > 0);
  if (v.banner) { v.banner.life -= dt; if (v.banner.life <= 0) v.banner = null; }
  v.shake = Math.max(0, v.shake - dt);
  for (const st of v.stars) { st.y += st.s * 15 * dt; if (st.y > HEIGHT) st.y = 0; }
}

function drawWord(g: CanvasRenderingContext2D, e: Enemy, locked: boolean, look: Look): void {
  const p = look.palette;
  const size = e.boss ? 26 : 20;
  g.font = `${size}px ${look.font}`;
  const text = e.word.join('');
  const w = g.measureText(text).width;
  const x = e.x - w / 2;
  g.fillStyle = locked ? alpha(p.correct, 0.15) : 'rgba(255, 255, 255, 0.05)';
  g.beginPath();
  g.roundRect(x - 8, e.y - size * 0.8, w + 16, size * 1.6, 8);
  g.fill();
  if (locked) { g.strokeStyle = p.correct; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = e.boss ? p.combo : p.text;
  g.fillText(text, x, e.y);
  if (e.typed > 0) {
    const pw = g.measureText(e.word.slice(0, e.typed).join('')).width;
    g.save();
    g.beginPath();
    g.rect(x, e.y - size, pw, size * 2);
    g.clip();
    g.fillStyle = p.correct;
    g.fillText(text, x, e.y);
    g.restore();
  }
}

export function render(g: CanvasRenderingContext2D, s: GameState, v: View, look: Look): void {
  const p = look.palette;
  g.save();
  g.fillStyle = '#0b0f1a';
  g.fillRect(0, 0, WIDTH, HEIGHT);
  if (v.shake > 0) g.translate((Math.random() - 0.5) * 30 * v.shake, (Math.random() - 0.5) * 30 * v.shake);

  g.fillStyle = '#2a3352';
  for (const st of v.stars) g.fillRect(st.x, st.y, st.s, st.s);

  g.textBaseline = 'middle';
  g.textAlign = 'left';
  for (const e of s.enemies) drawWord(g, e, e.id === s.lockId, look);

  g.lineWidth = 2;
  for (const l of v.lasers) {
    g.globalAlpha = l.life / LASER_LIFE;
    g.strokeStyle = p.correct;
    g.beginPath();
    g.moveTo(SHIP.x, SHIP.y - 18);
    g.lineTo(l.x, l.y);
    g.stroke();
  }
  g.globalAlpha = 1;

  const target = s.enemies.find((e) => e.id === s.lockId);
  const angle = target ? Math.atan2(target.y - SHIP.y, target.x - SHIP.x) + Math.PI / 2 : 0;
  g.save();
  g.translate(SHIP.x, SHIP.y);
  g.rotate(angle);
  g.shadowColor = p.correct;
  g.shadowBlur = 16;
  g.fillStyle = p.correct;
  g.beginPath();
  g.moveTo(0, -18);
  g.lineTo(13, 14);
  g.lineTo(0, 8);
  g.lineTo(-13, 14);
  g.closePath();
  g.fill();
  g.restore();

  drawParticles(g, v.particles);
  g.restore();

  g.font = `18px ${look.font}`;
  g.textBaseline = 'top';
  g.fillStyle = p.text;
  g.textAlign = 'left';
  g.fillText(`Score ${s.score}`, 16, 14);
  g.textAlign = 'center';
  g.fillText(`Wave ${s.wave}`, WIDTH / 2, 14);
  g.textAlign = 'right';
  g.fillStyle = p.error;
  g.fillText('♥'.repeat(Math.max(0, s.lives)), WIDTH - 16, 14);
  if (s.multiplier > 1) {
    g.fillStyle = p.combo;
    g.fillText(`×${s.multiplier}`, WIDTH - 16, 40);
  }

  if (v.banner) {
    g.globalAlpha = Math.min(1, v.banner.life);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = p.correct;
    g.font = `bold 36px ${look.font}`;
    g.fillText(v.banner.text, WIDTH / 2, HEIGHT / 2 - 20);
    g.fillStyle = p.text;
    g.font = `18px ${look.font}`;
    g.fillText(v.banner.sub, WIDTH / 2, HEIGHT / 2 + 20);
    g.globalAlpha = 1;
  }
}
