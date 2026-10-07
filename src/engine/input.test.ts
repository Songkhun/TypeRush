import { describe, expect, it } from 'vitest';
import { extractChars, updateMismatch } from './input';

describe('extractChars', () => {
  it('splits inserted text into code points', () => {
    expect(extractChars('a', 'insertText')).toEqual(['a']);
    expect(extractChars('ที่', 'insertText')).toEqual(['ท', 'ี', '่']);
  });
  it('ignores paste, replacement and empty input', () => {
    expect(extractChars('hello', 'insertFromPaste')).toEqual([]);
    expect(extractChars('the', 'insertReplacementText')).toEqual([]);
    expect(extractChars(null, 'insertText')).toEqual([]);
  });
});

describe('updateMismatch', () => {
  it('counts consecutive other-script chars and resets on matching script', () => {
    let c = 0;
    c = updateMismatch(c, 'd', 'th');
    c = updateMismatch(c, 'f', 'th');
    expect(c).toBe(2);
    c = updateMismatch(c, ' ', 'th'); // neutral char leaves count unchanged
    expect(c).toBe(2);
    c = updateMismatch(c, 'ก', 'th');
    expect(c).toBe(0);
  });
});
