import { scriptOf, type Lang } from './keyboard';

/** Characters actually typed, from an InputEvent. Paste/autocorrect/composition are ignored. */
export function extractChars(data: string | null, inputType: string): string[] {
  if (!data || inputType !== 'insertText') return [];
  return [...data];
}

/** Consecutive characters typed in the other language's script. Neutral chars leave it unchanged. */
export function updateMismatch(count: number, ch: string, lang: Lang): number {
  const script = scriptOf(ch);
  if (script === null) return count;
  return script === lang ? 0 : count + 1;
}
