import { useCallback, useRef, useState } from 'react';
import type { Lang } from '../engine/keyboard';
import { updateMismatch } from '../engine/input';
import { weakKeys, weaknessMap } from '../engine/keystats';
import { comboTier } from '../fx/combo';
import { applyTypingSession } from '../store/session';
import { useApp } from './AppContext';
import { ComboMeter } from './ComboMeter';
import { useFx } from './FxLayer';
import { HiddenInput } from './HiddenInput';
import { Keyboard } from './Keyboard';
import { Results, type FinishedRun } from './Results';
import { useTypingSession, type TestConfig } from './useTypingSession';
import { WordStream } from './WordStream';

const CONFIGS = {
  t15: { kind: 'time', seconds: 15 },
  t30: { kind: 'time', seconds: 30 },
  t60: { kind: 'time', seconds: 60 },
  w10: { kind: 'words', count: 10 },
  w25: { kind: 'words', count: 25 },
  w50: { kind: 'words', count: 50 },
} as const satisfies Record<string, TestConfig>;
type ConfigKey = keyof typeof CONFIGS;

const label = (c: TestConfig) => (c.kind === 'time' ? `${c.seconds}s` : `${c.count} words`);

export function TypingScreen({ mode }: { mode: 'test' | 'drill' }) {
  const { data } = useApp();
  const lang = data.settings.language;
  const [cfgKey, setCfgKey] = useState<ConfigKey>('t30');
  const [run, setRun] = useState(0);
  const restart = useCallback(() => setRun((r) => r + 1), []);

  return (
    <section className={`typing-screen lang-${lang}`}>
      <div className="cfg-bar">
        {(Object.keys(CONFIGS) as ConfigKey[]).map((k) => (
          <button key={k} className={`chip${k === cfgKey ? ' chip-on' : ''}`} onClick={() => { setCfgKey(k); restart(); }}>
            {label(CONFIGS[k])}
          </button>
        ))}
      </div>
      <TypingRun key={`${mode}-${lang}-${cfgKey}-${run}`} mode={mode} lang={lang} config={CONFIGS[cfgKey]} onRestart={restart} />
    </section>
  );
}

function TypingRun({ mode, lang, config, onRestart }: { mode: 'test' | 'drill'; lang: Lang; config: TestConfig; onRestart(): void }) {
  const { data, commit, sound, palette } = useApp();
  const fx = useFx();
  const dataRef = useRef(data);
  dataRef.current = data;
  const [weakness] = useState(() => weaknessMap(data.keyStats[lang]));
  const [targets] = useState(() => weakKeys(data.keyStats[lang]));
  const [mismatch, setMismatch] = useState(0);
  const [outcome, setOutcome] = useState<FinishedRun | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const prevTier = useRef(0);
  const prevEvents = useRef(0);

  const session = useTypingSession({
    lang, mode, config, weakness,
    onFinish: (result, samples, activeMs) => {
      const out = applyTypingSession(dataRef.current, { mode, lang, result, samples, activeMs, now: new Date() });
      commit(out.data);
      const levelUp = out.levelAfter > out.levelBefore ? out.levelAfter : null;
      setOutcome({ result, xpGained: out.xpGained, personalBest: out.personalBest, levelUp, weak: weakKeys(out.data.keyStats[lang]) });
      if (levelUp !== null) { sound.levelUp(); fx.confetti(); }
      else if (out.personalBest) { sound.fanfare(); fx.confetti(); }
    },
  });

  const onChar = (ch: string) => {
    setMismatch((c) => updateMismatch(c, ch, lang));
    const next = session.type(ch);
    if (next.events.length === prevEvents.current) return; // ignored (e.g. double space)
    prevEvents.current = next.events.length;
    const ev = next.events[next.events.length - 1];
    if (ev.correct) {
      sound.click(next.combo);
    } else {
      sound.error();
      fx.shake(streamRef.current);
    }
    const tier = comboTier(next.combo);
    if (tier > prevTier.current && comboRef.current) {
      const b = comboRef.current.getBoundingClientRect();
      fx.burst(b.left + b.width / 2, b.top + b.height / 2, 20 + tier * 10, [palette.text, palette.text, palette.correct, palette.combo, palette.error][tier]);
    }
    prevTier.current = tier;
  };

  if (outcome) return <Results {...outcome} onNext={onRestart} />;

  const s = session.state;
  const cur = s.words[s.wordIndex];
  const nextChar = cur ? (cur.typed.length < cur.target.length ? cur.target[cur.typed.length] : ' ') : null;
  const progress = config.kind === 'time'
    ? `${Math.max(0, Math.ceil(config.seconds - session.elapsedMs / 1000))}`
    : `${Math.min(s.wordIndex, config.count)}/${config.count}`;

  return (
    <>
      {mode === 'drill' && (
        <div className="drill-note">
          {targets.length
            ? <>Targeting your weak keys: {targets.map((k) => <kbd key={k}>{k}</kbd>)}</>
            : 'Not enough data yet. Finish a few tests first; using random words for now.'}
        </div>
      )}
      <div className="live-bar">
        <span className="timer">{progress}</span>
        <span>{Math.round(session.liveWpm)} wpm</span>
        <ComboMeter combo={s.combo} spanRef={comboRef} />
      </div>
      {mismatch >= 3 && (
        <div className="banner">Switch your input to {lang === 'th' ? 'Thai' : 'English'} (⌃Space)</div>
      )}
      <div className="stream-wrap">
        <div ref={streamRef}>
          <WordStream state={s} />
        </div>
        <HiddenInput onChar={onChar} onBackspace={session.backspace} onTab={onRestart} />
      </div>
      {data.settings.showKeyboard && <Keyboard lang={lang} nextChar={nextChar} />}
      <p className="hint">Start typing to begin · Tab restarts</p>
    </>
  );
}
