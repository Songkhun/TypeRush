import { describe, expect, it } from 'vitest';
import {
  drainEvents, newGame, release, SHIP, spawnEnemy, startWave, step, typeKey, waveConfig, type GameState,
} from './arcade';
import { mulberry32 } from '../engine/rng';

const src = () => ({ words: ['cat', 'dog', 'fish', 'apple', 'banana', 'kiwi'], rng: mulberry32(1) });
const quiet = (): GameState => { const s = newGame(); s.toSpawn = 0; return s; };
const typeWord = (s: GameState, w: string) => { for (const ch of w) typeKey(s, ch); };

describe('waves', () => {
  it('configures waves', () => {
    expect(waveConfig(1)).toMatchObject({ count: 7, boss: false });
    expect(waveConfig(5).boss).toBe(true);
    expect(waveConfig(2).speed).toBeGreaterThan(waveConfig(1).speed);
  });
  it('starts at wave 1 with 3 lives and spawns immediately', () => {
    const s = newGame();
    expect(s).toMatchObject({ wave: 1, lives: 3, toSpawn: 7, score: 0 });
    step(s, 1 / 60, src());
    expect(s.enemies).toHaveLength(1);
    expect(s.toSpawn).toBe(6);
  });
  it('ends a clean wave with a bonus and starts the next', () => {
    const s = quiet();
    step(s, 1 / 60, src());
    const ev = drainEvents(s);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'waveEnd', wave: 1, bonus: 100 }));
    expect(s.wave).toBe(2);
    expect(s.toSpawn).toBe(9);
    expect(s.score).toBe(100);
  });
  it('boss wave spawns a phrase boss that spawns minions', () => {
    const s = newGame();
    startWave(s, 5);
    s.toSpawn = 0;
    const source = src();
    step(s, 1 / 60, source);
    const boss = s.enemies.find((e) => e.boss)!;
    expect(boss.word).toContain(' ');
    boss.spawnTimer = 0;
    step(s, 1 / 60, source);
    expect(s.enemies.filter((e) => !e.boss).length).toBe(1);
  });
});

describe('movement and damage', () => {
  it('moves enemies toward the ship', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', SHIP.x, 100, 60);
    step(s, 1, src());
    expect(e.y).toBeCloseTo(160);
  });
  it('loses a life when an enemy reaches the ship', () => {
    const s = quiet();
    s.multiplier = 3;
    spawnEnemy(s, 'cat', SHIP.x, SHIP.y, 60);
    step(s, 1 / 60, src());
    expect(s.lives).toBe(2);
    expect(s.multiplier).toBe(1);
    expect(drainEvents(s)).toContainEqual({ type: 'damage' });
  });
  it('ends the game at zero lives', () => {
    const s = quiet();
    s.lives = 1;
    spawnEnemy(s, 'cat', SHIP.x, SHIP.y, 60);
    step(s, 1 / 60, src());
    expect(s.over).toBe(true);
    expect(drainEvents(s)).toContainEqual({ type: 'gameOver' });
  });
});

describe('typing', () => {
  it('locks onto the nearest matching enemy', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    const near = spawnEnemy(s, 'cow', 500, 400, 0);
    typeKey(s, 'c');
    expect(s.lockId).toBe(near.id);
    expect(near.typed).toBe(1);
  });
  it('a wrong key keeps the lock but resets the multiplier', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', 300, 100, 0);
    s.multiplier = 3; s.cleanStreak = 25;
    typeKey(s, 'c');
    typeKey(s, 'x');
    expect(s.lockId).toBe(e.id);
    expect(s.multiplier).toBe(1);
    expect(s.cleanStreak).toBe(0);
    expect(drainEvents(s)).toContainEqual({ type: 'miss' });
  });
  it('a key with no matching enemy is a miss', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeKey(s, 'z');
    expect(s.lockId).toBeNull();
    expect(drainEvents(s)).toContainEqual({ type: 'miss' });
  });
  it('destroying a word scores length × wave × multiplier', () => {
    const s = quiet();
    s.wave = 2; s.multiplier = 2;
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeWord(s, 'cat');
    expect(s.score).toBe(12);
    expect(s.enemies).toHaveLength(0);
    expect(s.lockId).toBeNull();
    expect(drainEvents(s)).toContainEqual(expect.objectContaining({ type: 'destroy', points: 12 }));
  });
  it('raises the multiplier every 10 clean words, max 4', () => {
    const s = quiet();
    for (let i = 0; i < 10; i++) { spawnEnemy(s, 'cat', 300, 100, 0); typeWord(s, 'cat'); }
    expect(s.multiplier).toBe(2);
    for (let i = 0; i < 40; i++) { spawnEnemy(s, 'cat', 300, 100, 0); typeWord(s, 'cat'); }
    expect(s.multiplier).toBe(4);
  });
  it('ignores space when no word is locked', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    s.multiplier = 3; s.cleanStreak = 25;
    typeKey(s, ' ');
    expect(s.keystrokes).toBe(0);
    expect(s.multiplier).toBe(3);
    expect(drainEvents(s)).toEqual([]);
  });
  it('still requires space inside a locked boss phrase', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'ab cd', 300, 100, 0, true);
    typeWord(s, 'ab ');
    expect(e.typed).toBe(3);
  });
  it('release drops the lock and resets progress', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', 300, 100, 0);
    typeKey(s, 'c');
    release(s);
    expect(s.lockId).toBeNull();
    expect(e.typed).toBe(0);
  });
  it('counts keystrokes for accuracy', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeWord(s, 'cxat');
    expect(s.keystrokes).toBe(4);
    expect(s.correctKeystrokes).toBe(3);
    expect(s.correctChars).toBe(3);
  });
});
