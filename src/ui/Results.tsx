import { useEffect } from 'react';
import type { SessionResult } from '../engine/metrics';
import { useApp } from './AppContext';
import { useCountUp } from './useCountUp';

export interface FinishedRun {
  result: SessionResult;
  xpGained: number;
  personalBest: boolean;
  levelUp: number | null;
  weak: string[];
}

export function Results({ result, xpGained, personalBest, levelUp, weak, onNext }: FinishedRun & { onNext(): void }) {
  const { intensity } = useApp();
  const animate = intensity !== 'off';
  const wpm = useCountUp(result.wpm, 900, animate);
  const xp = useCountUp(xpGained, 900, animate);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNext]);

  return (
    <div className="card results">
      {personalBest && <div className="pb">🎉 New personal best!</div>}
      {levelUp !== null && <div className="toast">⬆ Level up! You are now level {levelUp}</div>}
      <div className="big">{Math.round(wpm)}</div>
      <div className="muted">words per minute</div>
      <div className="stats-row">
        <div className="stat"><div className="label">accuracy</div><div className="value">{Math.round(result.acc * 100)}%</div></div>
        <div className="stat"><div className="label">raw wpm</div><div className="value">{Math.round(result.rawWpm)}</div></div>
        <div className="stat"><div className="label">best combo</div><div className="value">{result.maxCombo}</div></div>
        <div className="stat"><div className="label">xp</div><div className="value">+{Math.round(xp)}</div></div>
      </div>
      {weak.length > 0 && (
        <p>Weakest keys: {weak.map((k) => <kbd key={k}>{k}</kbd>)}</p>
      )}
      <button onClick={onNext}>Next (Tab)</button>
    </div>
  );
}
