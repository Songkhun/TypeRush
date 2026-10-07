import type { Rng } from '../engine/rng';

export const WIDTH = 800;
export const HEIGHT = 600;
export const SHIP = { x: WIDTH / 2, y: HEIGHT - 40 };
export const HIT_RADIUS = 30;
export const START_LIVES = 3;
export const BOSS_SPAWN_INTERVAL = 3;

export interface Enemy {
  id: number; word: string[]; typed: number; x: number; y: number; speed: number; boss: boolean; spawnTimer: number;
}

export type GameEvent =
  | { type: 'lock'; id: number }
  | { type: 'hit'; id: number; x: number; y: number }
  | { type: 'destroy'; x: number; y: number; points: number; boss: boolean }
  | { type: 'miss' }
  | { type: 'damage' }
  | { type: 'waveEnd'; wave: number; wpm: number; bonus: number }
  | { type: 'gameOver' };

export interface GameState {
  wave: number; lives: number; score: number; multiplier: number; cleanStreak: number;
  enemies: Enemy[]; lockId: number | null;
  toSpawn: number; spawnCooldown: number; bossPending: boolean;
  waveDamaged: boolean; waveChars: number; waveTime: number; time: number;
  over: boolean; nextId: number;
  keystrokes: number; correctKeystrokes: number; correctChars: number;
  events: GameEvent[];
}

export interface WordSource { words: readonly string[]; rng: Rng }

export function waveConfig(wave: number) {
  return {
    count: 5 + 2 * wave,
    speed: 40 + 8 * wave,
    maxLen: Math.min(4 + wave, 12),
    spawnInterval: Math.max(0.6, 2.2 - 0.12 * wave),
    boss: wave % 5 === 0,
  };
}

export function startWave(s: GameState, wave: number): void {
  const c = waveConfig(wave);
  s.wave = wave;
  s.toSpawn = c.count;
  s.spawnCooldown = 0;
  s.bossPending = c.boss;
  s.waveDamaged = false;
  s.waveChars = 0;
  s.waveTime = 0;
}

export function newGame(): GameState {
  const s: GameState = {
    wave: 1, lives: START_LIVES, score: 0, multiplier: 1, cleanStreak: 0,
    enemies: [], lockId: null, toSpawn: 0, spawnCooldown: 0, bossPending: false,
    waveDamaged: false, waveChars: 0, waveTime: 0, time: 0, over: false, nextId: 1,
    keystrokes: 0, correctKeystrokes: 0, correctChars: 0, events: [],
  };
  startWave(s, 1);
  return s;
}

export function spawnEnemy(s: GameState, word: string, x: number, y: number, speed: number, boss = false): Enemy {
  const e: Enemy = { id: s.nextId++, word: [...word], typed: 0, x, y, speed, boss, spawnTimer: BOSS_SPAWN_INTERVAL };
  s.enemies.push(e);
  return e;
}

function chooseWord(src: WordSource, maxLen: number, taken: Set<string>): string {
  const fits = src.words.filter((w) => [...w].length <= maxLen);
  const pool = fits.length ? fits : src.words;
  for (let i = 0; i < 10; i++) {
    const w = pool[Math.floor(src.rng() * pool.length)];
    if (!taken.has([...w][0])) return w;
  }
  return pool[Math.floor(src.rng() * pool.length)];
}

const dist = (e: Enemy) => Math.hypot(SHIP.x - e.x, SHIP.y - e.y);

export function step(s: GameState, dt: number, src: WordSource): void {
  if (s.over) return;
  s.time += dt;
  s.waveTime += dt;
  const cfg = waveConfig(s.wave);
  const firsts = new Set(s.enemies.map((e) => e.word[0]));
  const add = (word: string, x: number, y: number, speed: number, boss = false) => {
    firsts.add([...word][0]);
    return spawnEnemy(s, word, x, y, speed, boss);
  };

  if (s.bossPending) {
    const phrase = `${chooseWord(src, 12, firsts)} ${chooseWord(src, 12, new Set())}`;
    add(phrase, WIDTH / 2, -20, cfg.speed * 0.4, true);
    s.bossPending = false;
  }

  s.spawnCooldown -= dt;
  if (s.toSpawn > 0 && s.spawnCooldown <= 0) {
    add(chooseWord(src, cfg.maxLen, firsts), 60 + src.rng() * (WIDTH - 120), -20, cfg.speed);
    s.toSpawn--;
    s.spawnCooldown = cfg.spawnInterval;
  }

  const minions: [number, number][] = [];
  for (const e of s.enemies) {
    if (e.boss) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) { e.spawnTimer = BOSS_SPAWN_INTERVAL; minions.push([e.x, e.y + 30]); }
    }
    const d = dist(e) || 1;
    e.x += ((SHIP.x - e.x) / d) * e.speed * dt;
    e.y += ((SHIP.y - e.y) / d) * e.speed * dt;
  }
  for (const [x, y] of minions) add(chooseWord(src, 4, firsts), x, y, cfg.speed);

  const survivors: Enemy[] = [];
  for (const e of s.enemies) {
    if (dist(e) < HIT_RADIUS) {
      s.lives--;
      s.multiplier = 1;
      s.cleanStreak = 0;
      s.waveDamaged = true;
      if (s.lockId === e.id) s.lockId = null;
      s.events.push({ type: 'damage' });
    } else {
      survivors.push(e);
    }
  }
  s.enemies = survivors;

  if (s.lives <= 0) {
    s.over = true;
    s.events.push({ type: 'gameOver' });
    return;
  }

  if (s.toSpawn === 0 && !s.bossPending && s.enemies.length === 0) {
    const minutes = s.waveTime / 60;
    const wpm = minutes > 0 ? Math.round(s.waveChars / 5 / minutes) : 0;
    const bonus = s.waveDamaged ? 0 : 100 * s.wave;
    s.score += bonus;
    s.events.push({ type: 'waveEnd', wave: s.wave, wpm, bonus });
    startWave(s, s.wave + 1);
  }
}

function miss(s: GameState): void {
  s.cleanStreak = 0;
  s.multiplier = 1;
  s.events.push({ type: 'miss' });
}

export function typeKey(s: GameState, ch: string): void {
  if (s.over) return;
  s.keystrokes++;
  let target = s.lockId !== null ? s.enemies.find((e) => e.id === s.lockId) : undefined;
  if (!target) {
    s.lockId = null;
    const candidates = s.enemies.filter((e) => e.typed === 0 && e.word[0] === ch);
    if (candidates.length === 0) { miss(s); return; }
    target = candidates.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    s.lockId = target.id;
    s.events.push({ type: 'lock', id: target.id });
  }
  if (target.word[target.typed] !== ch) { miss(s); return; }

  target.typed++;
  s.correctKeystrokes++;
  s.correctChars++;
  s.waveChars++;
  s.events.push({ type: 'hit', id: target.id, x: target.x, y: target.y });

  if (target.typed === target.word.length) {
    const points = target.word.length * s.wave * s.multiplier;
    s.score += points;
    s.cleanStreak++;
    s.multiplier = Math.min(4, 1 + Math.floor(s.cleanStreak / 10));
    const done = target;
    s.enemies = s.enemies.filter((e) => e !== done);
    s.lockId = null;
    s.events.push({ type: 'destroy', x: done.x, y: done.y, points, boss: done.boss });
  }
}

export function release(s: GameState): void {
  const e = s.enemies.find((x) => x.id === s.lockId);
  if (e) e.typed = 0;
  s.lockId = null;
}

export function drainEvents(s: GameState): GameEvent[] {
  const ev = s.events;
  s.events = [];
  return ev;
}
