import { useState } from 'react';
import { defaultData, type FxIntensity, type Settings } from '../store/storage';
import { useApp } from './AppContext';

const FX: FxIntensity[] = ['off', 'subtle', 'full'];

export function SettingsScreen() {
  const { data, commit, intensity } = useApp();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => commit({ ...data, settings: { ...s, ...patch } });
  const [goalText, setGoalText] = useState(String(s.dailyGoalMin));
  const commitGoal = () => {
    const v = Math.round(Number(goalText));
    const goal = goalText.trim() !== '' && Number.isFinite(v) ? Math.min(120, Math.max(1, v)) : s.dailyGoalMin;
    setGoalText(String(goal));
    if (goal !== s.dailyGoalMin) set({ dailyGoalMin: goal });
  };

  return (
    <section className="settings card">
      <h2 style={{ margin: 0 }}>Settings</h2>
      <label className="setting">Sound
        <button onClick={() => set({ sound: !s.sound })}>{s.sound ? 'On' : 'Off'}</button>
      </label>
      <div className="setting">Effects
        <div className="nav">
          {FX.map((f) => (
            <button key={f} className={f === s.fxIntensity ? 'chip chip-on' : 'chip'} onClick={() => set({ fxIntensity: f })}>{f}</button>
          ))}
        </div>
      </div>
      {intensity === 'off' && s.fxIntensity !== 'off' && (
        <p className="muted">Your system's Reduce Motion setting is on, so effects stay off.</p>
      )}
      <label className="setting">Daily goal (minutes)
        <input
          type="number" min={1} max={120} value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          onBlur={commitGoal}
          onKeyDown={(e) => { if (e.key === 'Enter') commitGoal(); }}
        />
      </label>
      <label className="setting">On-screen keyboard
        <button onClick={() => set({ showKeyboard: !s.showKeyboard })}>{s.showKeyboard ? 'Shown' : 'Hidden'}</button>
      </label>
      <div className="setting">Reset progress
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('Erase all progress (XP, history, key stats, streak)? Settings are kept. This cannot be undone.')) {
              commit({ ...defaultData(), settings: s });
            }
          }}
        >Reset</button>
      </div>
    </section>
  );
}
