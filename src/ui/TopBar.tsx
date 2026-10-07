import type { Lang } from '../engine/keyboard';
import { computeStreak, levelInfo } from '../engine/progress';
import { useApp } from './AppContext';
import type { Screen } from './App';

const NAV: [Screen, string][] = [['test', 'Test'], ['drill', 'Drill'], ['arcade', 'Arcade'], ['stats', 'Stats'], ['settings', 'Settings']];

export function TopBar({ screen, onNav }: { screen: Screen; onNav(s: Screen): void }) {
  const { data, commit } = useApp();
  const lv = levelInfo(data.xp);
  const streak = computeStreak(data.daily, data.settings.dailyGoalMin * 60000, new Date());
  const setLang = (language: Lang) => commit({ ...data, settings: { ...data.settings, language } });

  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNav('home')}>⌨ Type<span>Rush</span></button>
      <nav className="nav">
        {NAV.map(([id, label]) => (
          <button key={id} className={screen === id ? 'on' : ''} onClick={() => onNav(id)}>{label}</button>
        ))}
      </nav>
      <div className="spacer" />
      <div className="lang-toggle" role="group" aria-label="Language">
        {(['en', 'th'] as const).map((l) => (
          <button key={l} className={data.settings.language === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div className="level" title={`${lv.intoLevel} / ${lv.needed} XP`}>
        Lv {lv.level}
        <div className="xpbar"><div style={{ width: `${(lv.intoLevel / lv.needed) * 100}%` }} /></div>
      </div>
      <div className="streak" title="Day streak">🔥 {streak}</div>
    </header>
  );
}
