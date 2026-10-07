import { clusterSizes } from './text';

export type CharState = 'pending' | 'correct' | 'incorrect' | 'missed' | 'extra';
export type ClusterState = CharState | 'partial';

export interface KeyEvent { expected: string | null; typed: string; correct: boolean; t: number }
export interface WordState { target: string[]; typed: string[] }
export interface TypingState {
  words: WordState[];
  wordIndex: number;
  keystrokes: number;
  correctKeystrokes: number;
  missed: number;
  combo: number;
  maxCombo: number;
  events: KeyEvent[];
}

export const MAX_EXTRA = 10;

const toWordState = (w: string): WordState => ({ target: [...w], typed: [] });

export function createTyping(words: readonly string[]): TypingState {
  return {
    words: words.map(toWordState), wordIndex: 0,
    keystrokes: 0, correctKeystrokes: 0, missed: 0, combo: 0, maxCombo: 0, events: [],
  };
}

export function appendWords(s: TypingState, words: readonly string[]): TypingState {
  return { ...s, words: [...s.words, ...words.map(toWordState)] };
}

export function isFinished(s: TypingState): boolean {
  if (s.wordIndex >= s.words.length) return true;
  const last = s.words.length - 1;
  const w = s.words[last];
  return s.wordIndex === last && w.typed.join('') === w.target.join('');
}

export function typeChar(s: TypingState, ch: string, t: number): TypingState {
  if (isFinished(s)) return s;
  const word = s.words[s.wordIndex];

  if (ch === ' ') {
    if (word.typed.length === 0) return s;
    const exact = word.typed.join('') === word.target.join('');
    const combo = exact ? s.combo + 1 : 0;
    return {
      ...s,
      wordIndex: s.wordIndex + 1,
      keystrokes: s.keystrokes + 1,
      correctKeystrokes: s.correctKeystrokes + (exact ? 1 : 0),
      missed: s.missed + Math.max(0, word.target.length - word.typed.length),
      combo,
      maxCombo: Math.max(s.maxCombo, combo),
      events: [...s.events, { expected: ' ', typed: ' ', correct: exact, t }],
    };
  }

  const pos = word.typed.length;
  if (pos >= word.target.length + MAX_EXTRA) return s;
  const expected = pos < word.target.length ? word.target[pos] : null;
  const correct = expected === ch;
  const combo = correct ? s.combo + 1 : 0;
  const words = s.words.slice();
  words[s.wordIndex] = { ...word, typed: [...word.typed, ch] };
  return {
    ...s,
    words,
    keystrokes: s.keystrokes + 1,
    correctKeystrokes: s.correctKeystrokes + (correct ? 1 : 0),
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    events: [...s.events, { expected, typed: ch, correct, t }],
  };
}

export function backspace(s: TypingState): TypingState {
  const word = s.words[s.wordIndex];
  if (!word || word.typed.length === 0) return s;
  const words = s.words.slice();
  words[s.wordIndex] = { ...word, typed: word.typed.slice(0, -1) };
  return { ...s, words };
}

export function correctChars(s: TypingState): number {
  let n = Math.min(s.wordIndex, s.words.length); // one correct space per completed word
  const upto = Math.min(s.wordIndex, s.words.length - 1);
  for (let i = 0; i <= upto; i++) {
    const w = s.words[i];
    const len = Math.min(w.typed.length, w.target.length);
    for (let j = 0; j < len; j++) if (w.typed[j] === w.target[j]) n++;
  }
  return n;
}

export function wordView(w: WordState, done: boolean): { ch: string; state: CharState }[] {
  const out: { ch: string; state: CharState }[] = w.target.map((ch, i) => {
    if (i >= w.typed.length) return { ch, state: done ? 'missed' : 'pending' };
    return { ch, state: w.typed[i] === ch ? 'correct' : 'incorrect' };
  });
  for (let i = w.target.length; i < w.typed.length; i++) out.push({ ch: w.typed[i], state: 'extra' });
  return out;
}

export interface ClusterView { text: string; state: ClusterState; start: number }

function clusterState(states: CharState[]): ClusterState {
  if (states.includes('incorrect')) return 'incorrect';
  if (states.includes('missed')) return 'missed';
  if (states.every((s) => s === 'correct')) return 'correct';
  if (states.every((s) => s === 'pending')) return 'pending';
  return 'partial';
}

export function clusterView(w: WordState, done: boolean): ClusterView[] {
  const view = wordView(w, done);
  const out: ClusterView[] = [];
  let start = 0;
  for (const size of clusterSizes(w.target)) {
    const part = view.slice(start, start + size);
    out.push({ text: part.map((p) => p.ch).join(''), state: clusterState(part.map((p) => p.state)), start });
    start += size;
  }
  for (let i = w.target.length; i < view.length; i++) out.push({ text: view[i].ch, state: 'extra', start: i });
  return out;
}
