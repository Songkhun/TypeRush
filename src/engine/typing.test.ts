import { describe, expect, it } from 'vitest';
import {
  appendWords, backspace, clusterView, correctChars, createTyping, isFinished, MAX_EXTRA, typeChar, wordView,
  type TypingState,
} from './typing';

function typeAll(s: TypingState, text: string, t0 = 0): TypingState {
  let t = t0;
  for (const ch of text) s = typeChar(s, ch, (t += 100));
  return s;
}

describe('typeChar', () => {
  it('counts correct chars and builds combo', () => {
    const s = typeAll(createTyping(['ab', 'cd']), 'ab');
    expect(s.keystrokes).toBe(2);
    expect(s.correctKeystrokes).toBe(2);
    expect(s.combo).toBe(2);
    expect(s.words[0].typed).toEqual(['a', 'b']);
  });
  it('marks wrong chars, resets combo, records expected char', () => {
    const s = typeAll(createTyping(['ab']), 'ax');
    expect(s.correctKeystrokes).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.events[1]).toMatchObject({ expected: 'b', typed: 'x', correct: false });
  });
  it('space advances; exact word counts the space as correct', () => {
    const s = typeAll(createTyping(['ab', 'cd']), 'ab ');
    expect(s.wordIndex).toBe(1);
    expect(s.correctKeystrokes).toBe(3);
    expect(s.combo).toBe(3);
  });
  it('space on an incomplete word counts missed chars and breaks combo', () => {
    const s = typeAll(createTyping(['abc', 'd']), 'a ');
    expect(s.wordIndex).toBe(1);
    expect(s.missed).toBe(2);
    expect(s.combo).toBe(0);
    expect(s.correctKeystrokes).toBe(1);
  });
  it('ignores space at the start of a word (double space)', () => {
    let s = typeAll(createTyping(['ab', 'cd']), 'ab ');
    const before = s;
    s = typeChar(s, ' ', 999);
    expect(s).toBe(before);
    s = typeChar(createTyping(['ab']), ' ', 1);
    expect(s.keystrokes).toBe(0);
    expect(s.wordIndex).toBe(0);
  });
  it('records extra chars up to MAX_EXTRA and ignores the rest', () => {
    let s = typeAll(createTyping(['a', 'b']), 'a');
    s = typeAll(s, 'z'.repeat(MAX_EXTRA + 5));
    expect(s.words[0].typed.length).toBe(1 + MAX_EXTRA);
    expect(s.keystrokes).toBe(1 + MAX_EXTRA);
    expect(s.events.at(-1)!.expected).toBeNull();
  });
  it('handles Thai combining marks as separate keystrokes', () => {
    const s = typeAll(createTyping(['ที่']), 'ที่');
    expect(s.correctKeystrokes).toBe(3);
    expect(isFinished(s)).toBe(true);
  });
});

describe('backspace', () => {
  it('removes the last char in the current word only', () => {
    let s = typeAll(createTyping(['ab', 'cd']), 'ax');
    s = backspace(s);
    expect(s.words[0].typed).toEqual(['a']);
    expect(s.keystrokes).toBe(2); // keystrokes are never refunded
    s = typeAll(s, 'b c');
    s = backspace(backspace(s));
    expect(s.wordIndex).toBe(1);
    expect(s.words[1].typed).toEqual([]);
    expect(s.words[0].typed).toEqual(['a', 'b']);
  });
});

describe('isFinished / correctChars / appendWords', () => {
  it('finishes when the last word is typed exactly', () => {
    expect(isFinished(typeAll(createTyping(['ab', 'cd']), 'ab c'))).toBe(false);
    expect(isFinished(typeAll(createTyping(['ab', 'cd']), 'ab cd'))).toBe(true);
  });
  it('counts matching chars plus spaces', () => {
    expect(correctChars(typeAll(createTyping(['ab', 'cd']), 'ab cd'))).toBe(5);
    expect(correctChars(typeAll(createTyping(['ab', 'cd']), 'ax cd'))).toBe(4);
  });
  it('appends words', () => {
    const s = appendWords(createTyping(['a']), ['b', 'c']);
    expect(s.words.map((w) => w.target.join(''))).toEqual(['a', 'b', 'c']);
  });
});

describe('views', () => {
  it('wordView marks pending, correct, incorrect, missed, extra', () => {
    expect(wordView({ target: [...'abc'], typed: [...'ax'] }, false).map((v) => v.state))
      .toEqual(['correct', 'incorrect', 'pending']);
    expect(wordView({ target: [...'abc'], typed: [...'a'] }, true).map((v) => v.state))
      .toEqual(['correct', 'missed', 'missed']);
    expect(wordView({ target: [...'a'], typed: [...'ab'] }, false).map((v) => v.state))
      .toEqual(['correct', 'extra']);
  });
  it('clusterView groups Thai and reports partial clusters', () => {
    const w = { target: [...'ที่นี่'], typed: [...'ที'] };
    const v = clusterView(w, false);
    expect(v.map((c) => c.text)).toEqual(['ที่', 'นี่']);
    expect(v.map((c) => c.state)).toEqual(['partial', 'pending']);
    expect(v[1].start).toBe(3);
  });
  it('clusterView uses worst state in a cluster', () => {
    const v = clusterView({ target: [...'ที่'], typed: ['ท', 'ิ', '่'] }, false);
    expect(v[0].state).toBe('incorrect');
  });
});
