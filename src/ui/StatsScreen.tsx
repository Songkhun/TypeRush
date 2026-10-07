import { useMemo } from 'react';
import { errorRates } from '../engine/keystats';
import { bestWpm } from '../store/session';
import { useApp } from './AppContext';
import { Keyboard } from './Keyboard';
import { LineChart } from './LineChart';

export function StatsScreen() {
  const { data } = useApp();
  const lang = data.settings.language;
  const sessions = data.sessions.filter((s) => s.lang === lang && s.mode !== 'arcade').slice(-50);
  const heat = useMemo(() => errorRates(data.keyStats[lang]), [data.keyStats, lang]);
  const hasHeat = Object.keys(heat).length > 0;

  return (
    <section className={`stats-page lang-${lang}`}>
      <div className="card">
        <h2>Progress ({lang === 'th' ? 'Thai' : 'English'})</h2>
        <LineChart sessions={sessions} />
      </div>
      <div className="card">
        <h2>Personal bests</h2>
        <div className="stats-row">
          <div className="stat"><div className="label">test</div><div className="value">{Math.round(bestWpm(data, 'test', lang))} wpm</div></div>
          <div className="stat"><div className="label">drill</div><div className="value">{Math.round(bestWpm(data, 'drill', lang))} wpm</div></div>
          <div className="stat"><div className="label">arcade</div><div className="value">{data.arcadeHigh[lang]}</div></div>
          <div className="stat"><div className="label">sessions</div><div className="value">{data.sessions.filter((s) => s.lang === lang).length}</div></div>
        </div>
      </div>
      <div className="card">
        <h2>Key error heatmap</h2>
        {hasHeat
          ? <Keyboard lang={lang} heat={heat} />
          : <p className="muted">Each key needs at least 10 presses before it shows up here.</p>}
      </div>
    </section>
  );
}
