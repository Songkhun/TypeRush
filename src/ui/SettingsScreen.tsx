import { useState } from 'react';
import { SOUND_PACK_IDS, SOUND_PACKS } from '../fx/soundPacks';
import { FONT_IDS, FONT_SIZE, FONTS } from '../prefs/fonts';
import { THEME_IDS, THEMES } from '../prefs/themes';
import { defaultData, type FxIntensity, type Settings } from '../store/storage';
import { useApp } from './AppContext';

const FX: FxIntensity[] = ['off', 'subtle', 'full'];

export function SettingsScreen() {
  const { data, commit, intensity, sound } = useApp();
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

      <h3 className="settings-group">Sound</h3>
      <label className="setting">Sound
        <button onClick={() => set({ sound: !s.sound })}>{s.sound ? 'On' : 'Off'}</button>
      </label>
      <div className="setting">Key sound
        <div className="nav">
          {SOUND_PACK_IDS.map((id) => (
            <button
              key={id}
              className={id === s.soundPack ? 'chip chip-on' : 'chip'}
              disabled={!s.sound}
              onClick={() => { set({ soundPack: id }); sound.pack = id; sound.preview(); }}
            >{SOUND_PACKS[id].name}</button>
          ))}
        </div>
      </div>
      <label className="setting">Volume
        <span className="slider">
          <input
            type="range" min={0} max={100} step={5} value={Math.round(s.volume * 100)} disabled={!s.sound}
            aria-label="Volume"
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => sound.click(10)}
          />
          <span className="muted">{Math.round(s.volume * 100)}%</span>
        </span>
      </label>

      <h3 className="settings-group">Look</h3>
      <div className="setting">Color theme
        <div className="swatches">
          {THEME_IDS.map((id) => {
            const p = THEMES[id].palette;
            return (
              <button
                key={id}
                className={`swatch${id === s.theme ? ' swatch-on' : ''}`}
                onClick={() => set({ theme: id })}
                aria-pressed={id === s.theme}
                title={THEMES[id].name}
              >
                <span className="swatch-dots">
                  {[p.correct, p.error, p.combo, p.muted].map((c) => <i key={c} style={{ background: c }} />)}
                </span>
                {THEMES[id].name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting">Font
        <div className="nav">
          {FONT_IDS.map((id) => (
            <button
              key={id}
              className={id === s.font ? 'chip chip-on' : 'chip'}
              style={{ fontFamily: FONTS[id].stack }}
              onClick={() => set({ font: id })}
            >{FONTS[id].name}</button>
          ))}
        </div>
      </div>
      <label className="setting">Text size
        <span className="slider">
          <input
            type="range" min={FONT_SIZE.min} max={FONT_SIZE.max} step={FONT_SIZE.step} value={s.fontSize}
            aria-label="Text size"
            onChange={(e) => set({ fontSize: Number(e.target.value) })}
          />
          <span className="muted">{Math.round((s.fontSize / FONT_SIZE.default) * 100)}%</span>
        </span>
      </label>
      <div className="preview stream-preview" aria-label="Preview">
        <span className="ch-correct">The quick </span>
        <span className="ch-incorrect">b</span>
        <span className="ch caret ch-pending">rown fox</span>
        <br />
        <span className="ch-correct">สวัสดี</span><span className="ch-pending">ครับ พิมพ์เร็ว</span>
      </div>

      <h3 className="settings-group">Practice</h3>
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
