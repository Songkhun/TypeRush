import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Lang } from '../engine/keyboard';
import { computeResult, keySamples, perMinute, type KeySample, type SessionResult } from '../engine/metrics';
import { activeTimeMs } from '../engine/progress';
import { mulberry32 } from '../engine/rng';
import {
  appendWords, backspace as backspaceState, correctChars, createTyping, isFinished, typeChar, type TypingState,
} from '../engine/typing';
import { randomWords, weightedWords } from '../engine/wordgen';
import { WORDS } from '../data/words';

export type TestConfig = { kind: 'time'; seconds: number } | { kind: 'words'; count: number };

interface Options {
  lang: Lang;
  mode: 'test' | 'drill';
  config: TestConfig;
  weakness: Record<string, number>;
  onFinish(result: SessionResult, samples: Record<string, KeySample>, activeMs: number): void;
}

interface Run { typing: TypingState; start: number | null; end: number | null }

/** One typing run. Remount (change `key`) to start a new run with new options. */
export function useTypingSession(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const rng = useRef(mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const [, force] = useReducer((x: number) => x + 1, 0);

  const makeWords = useCallback((n: number) => {
    const { lang, mode, weakness } = optsRef.current;
    return mode === 'drill'
      ? weightedWords(WORDS[lang], n, weakness, rng.current)
      : randomWords(WORDS[lang], n, rng.current);
  }, []);

  const run = useRef<Run | null>(null);
  if (run.current === null) {
    const c = opts.config;
    run.current = { typing: createTyping(makeWords(c.kind === 'words' ? c.count : 60)), start: null, end: null };
  }

  const finish = useCallback((end: number) => {
    const r = run.current!;
    if (r.end !== null || r.start === null) return;
    r.end = end;
    force();
    const s = r.typing;
    optsRef.current.onFinish(computeResult(s, end - r.start), keySamples(s.events), activeTimeMs(s.events.map((e) => e.t)));
  }, []);

  const type = useCallback((ch: string): TypingState => {
    const r = run.current!;
    if (r.end !== null) return r.typing;
    const t = performance.now();
    const { config } = optsRef.current;
    if (r.start === null) r.start = t;
    if (config.kind === 'time' && t - r.start >= config.seconds * 1000) {
      finish(r.start + config.seconds * 1000);
      return r.typing;
    }
    let next = typeChar(r.typing, ch, t);
    if (config.kind === 'time' && next.words.length - next.wordIndex < 20) next = appendWords(next, makeWords(40));
    r.typing = next;
    force();
    if (config.kind === 'words' && isFinished(next)) finish(t);
    return next;
  }, [finish, makeWords]);

  const backspace = useCallback(() => {
    const r = run.current!;
    if (r.end !== null) return;
    r.typing = backspaceState(r.typing);
    force();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = run.current!;
      if (r.start === null || r.end !== null) return;
      const { config } = optsRef.current;
      if (config.kind === 'time' && performance.now() - r.start >= config.seconds * 1000) {
        finish(r.start + config.seconds * 1000);
      } else {
        force();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [finish]);

  const r = run.current;
  const elapsedMs = r.start === null ? 0 : (r.end ?? performance.now()) - r.start;
  return {
    state: r.typing,
    type,
    backspace,
    elapsedMs,
    liveWpm: elapsedMs > 1000 ? perMinute(correctChars(r.typing), elapsedMs) : 0,
    finished: r.end !== null,
  };
}
