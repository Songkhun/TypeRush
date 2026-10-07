import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../engine/keyboard';
import { activeTimeMs } from '../engine/progress';
import { mulberry32 } from '../engine/rng';
import { burst, particleCount } from '../fx/particles';
import { drainEvents, HEIGHT, newGame, release, SHIP, step, typeKey, WIDTH, type GameEvent, type WordSource } from '../game/arcade';
import { createView, LASER_LIFE, render, updateView } from '../game/render';
import { applyArcadeSession } from '../store/session';
import { WORDS } from '../data/words';
import { useApp } from './AppContext';
import { useFx } from './FxLayer';
import { HiddenInput } from './HiddenInput';

interface GameOver { score: number; wave: number; xp: number; high: boolean }

export function ArcadeScreen({ onExit }: { onExit(): void }) {
  const { data } = useApp();
  const lang = data.settings.language;
  const [run, setRun] = useState(0);
  return <ArcadeRun key={`${lang}-${run}`} lang={lang} onAgain={() => setRun((r) => r + 1)} onExit={onExit} />;
}

function ArcadeRun({ lang, onAgain, onExit }: { lang: Lang; onAgain(): void; onExit(): void }) {
  const app = useApp();
  const fx = useFx();
  const appRef = useRef(app);
  appRef.current = app;
  const fxRef = useRef(fx);
  fxRef.current = fx;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef(newGame());
  const src = useRef<WordSource>({ words: WORDS[lang], rng: mulberry32(Date.now() >>> 0) });
  const view = useRef(createView());
  const keyTimes = useRef<number[]>([]);
  const [started, setStarted] = useState(false);
  const [focused, setFocused] = useState(true);
  const [over, setOver] = useState<GameOver | null>(null);
  const runningRef = useRef(false);
  runningRef.current = started && focused && !over;

  useEffect(() => {
    const handle = (ev: GameEvent) => {
      const { sound, intensity } = appRef.current;
      const v = view.current;
      switch (ev.type) {
        case 'hit':
          v.lasers.push({ x: ev.x, y: ev.y, life: LASER_LIFE });
          sound.laser();
          break;
        case 'destroy':
          v.particles.push(...burst(ev.x, ev.y, particleCount(ev.boss ? 80 : 26, intensity), ev.boss ? '#fbbf24' : '#22d3ee'));
          sound.explosion();
          break;
        case 'miss':
          sound.error();
          break;
        case 'damage':
          if (intensity !== 'off') v.shake = intensity === 'full' ? 0.4 : 0.15;
          v.particles.push(...burst(SHIP.x, SHIP.y, particleCount(30, intensity), '#f472b6'));
          sound.error();
          break;
        case 'waveEnd':
          v.banner = {
            text: `Wave ${ev.wave} cleared!`,
            sub: `${ev.wpm} WPM${ev.bonus ? `  ·  +${ev.bonus} no-damage bonus` : ''}`,
            life: 2.5,
          };
          sound.fanfare();
          break;
        case 'gameOver': {
          const g = game.current;
          const minutes = g.time / 60;
          const out = applyArcadeSession(appRef.current.data, {
            lang,
            score: g.score,
            wpm: minutes > 0 ? g.correctChars / 5 / minutes : 0,
            acc: g.keystrokes ? g.correctKeystrokes / g.keystrokes : 0,
            durationMs: g.time * 1000,
            activeMs: activeTimeMs(keyTimes.current),
            now: new Date(),
          });
          appRef.current.commit(out.data);
          setOver({ score: g.score, wave: g.wave, xp: out.xpGained, high: out.highScore });
          if (out.highScore || out.levelAfter > out.levelBefore) { sound.fanfare(); fxRef.current.confetti(); }
          break;
        }
        case 'lock':
          break;
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (runningRef.current) {
        acc += dt;
        while (acc >= STEP) { step(game.current, STEP, src.current); acc -= STEP; }
      } else {
        acc = 0;
      }
      drainEvents(game.current).forEach(handle);
      updateView(view.current, dt);
      const g = canvasRef.current?.getContext('2d');
      if (g) render(g, game.current, view.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lang]);

  useEffect(() => {
    if (!over) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter') onAgain(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [over, onAgain]);

  const onChar = (ch: string) => {
    if (!started) { setStarted(true); return; }
    if (over) return;
    keyTimes.current.push(performance.now());
    typeKey(game.current, ch);
  };

  return (
    <section className={`arcade lang-${lang}`}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      {!over && <HiddenInput onChar={onChar} onEscape={() => release(game.current)} onFocusChange={setFocused} />}
      {!started && (
        <div className="card overlay-card">
          <h2>Word Defense</h2>
          <p className="muted">Type the falling words before they reach your ship.<br />Esc drops your target.</p>
          <p>Press any letter to start</p>
        </div>
      )}
      {over && (
        <div className="card overlay-card">
          <h2>Game over</h2>
          {over.high && <div className="pb">🏆 New high score!</div>}
          <div className="big">{over.score}</div>
          <p className="muted">Reached wave {over.wave} · +{over.xp} XP · Best {app.data.arcadeHigh[lang]}</p>
          <button onClick={onAgain}>Play again (Enter)</button>{' '}
          <button onClick={onExit}>Home</button>
        </div>
      )}
    </section>
  );
}
