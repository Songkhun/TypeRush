import { defaultData, type FxIntensity, type Settings } from '../store/storage';
import { useApp } from './AppContext';

const FX: FxIntensity[] = ['off', 'subtle', 'full'];

export function SettingsScreen() {
  const { data, commit, intensity } = useApp();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => commit({ ...data, settings: { ...s, ...patch } });

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
          type="number" min={1} max={120} value={s.dailyGoalMin}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            if (Number.isFinite(v)) set({ dailyGoalMin: Math.min(120, Math.max(1, v)) });
          }}
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
