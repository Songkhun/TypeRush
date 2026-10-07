import { dateKey } from '../engine/progress';
import { useApp } from './AppContext';
import type { Screen } from './App';

const R = 52, C = 2 * Math.PI * R;

export function HomeScreen({ onNav }: { onNav(s: Screen): void }) {
  const { data } = useApp();
  const goalMs = data.settings.dailyGoalMin * 60000;
  const todayMs = data.daily[dateKey(new Date())]?.activeMs ?? 0;
  const pct = Math.min(1, todayMs / goalMs);
  const recent = data.sessions.slice(-5).reverse();

  return (
    <div className="home-grid">
      <div className="card ring-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-label="Daily goal progress">
          <circle cx="70" cy="70" r={R} stroke="#243050" strokeWidth="12" fill="none" />
          <circle
            cx="70" cy="70" r={R} stroke={pct >= 1 ? '#fbbf24' : '#22d3ee'} strokeWidth="12" fill="none"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} strokeLinecap="round" transform="rotate(-90 70 70)"
          />
          <text x="70" y="76" textAnchor="middle" fill="#c9d1e0" fontSize="22" fontWeight="700">{Math.round(pct * 100)}%</text>
        </svg>
        <div>{(todayMs / 60000).toFixed(1)} / {data.settings.dailyGoalMin} min today</div>
        <div className="muted">{pct >= 1 ? 'Goal done. Streak safe 🔥' : 'Hit your goal to keep the streak'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="modes">
          <button className="mode-card" onClick={() => onNav('test')}><h3>Test</h3><p>Timed or word-count runs with combos</p></button>
          <button className="mode-card" onClick={() => onNav('drill')}><h3>Drill</h3><p>Words built around your weakest keys</p></button>
          <button className="mode-card" onClick={() => onNav('arcade')}><h3>Arcade</h3><p>Blast falling words before they hit you</p></button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent</h3>
          {recent.length === 0 ? (
            <p className="muted">No sessions yet. Pick a mode above.</p>
          ) : (
            <ul className="recent">
              {recent.map((s) => (
                <li key={s.ts}>
                  <span>{s.mode} · {s.lang.toUpperCase()}</span>
                  <span>{Math.round(s.wpm)} wpm · {Math.round(s.acc * 100)}%</span>
                  <span className="muted">{new Date(s.ts).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
