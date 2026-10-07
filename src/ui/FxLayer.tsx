import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { burst, drawParticles, particleCount, stepParticles, type Particle } from '../fx/particles';
import { useApp } from './AppContext';

interface FxApi {
  burst(x: number, y: number, count: number, color: string): void;
  confetti(): void;
  shake(el: HTMLElement | null): void;
}

const FxCtx = createContext<FxApi>({ burst() {}, confetti() {}, shake() {} });

const CONFETTI = ['#22d3ee', '#f472b6', '#fbbf24', '#a78bfa', '#34d399'];

export function retrigger(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth; // restart CSS animation
  el.classList.add(cls);
}

export function FxLayer({ children }: { children: ReactNode }) {
  const { intensity } = useApp();
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef(0);

  const run = useCallback(() => {
    if (raf.current) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      particles.current = stepParticles(particles.current, dt, 500);
      const c = canvasRef.current;
      const g = c?.getContext('2d');
      if (c && g) {
        if (c.width !== window.innerWidth || c.height !== window.innerHeight) {
          c.width = window.innerWidth;
          c.height = window.innerHeight;
        }
        g.clearRect(0, 0, c.width, c.height);
        drawParticles(g, particles.current);
      }
      raf.current = particles.current.length ? requestAnimationFrame(frame) : 0;
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const api = useMemo<FxApi>(() => ({
    burst(x, y, count, color) {
      const n = particleCount(count, intensityRef.current);
      if (!n) return;
      particles.current.push(...burst(x, y, n, color));
      run();
    },
    confetti() {
      const n = particleCount(150, intensityRef.current);
      for (let i = 0; i < n; i++) {
        particles.current.push(...burst(Math.random() * window.innerWidth, -10, 1, CONFETTI[i % CONFETTI.length], Math.random, 300));
      }
      if (n) run();
    },
    shake(el) {
      if (intensityRef.current === 'off' || !el) return;
      retrigger(el, 'shake');
    },
  }), [run]);

  return (
    <FxCtx.Provider value={api}>
      {children}
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden />
    </FxCtx.Provider>
  );
}

export function useFx(): FxApi {
  return useContext(FxCtx);
}
