import { useEffect, useRef, useState } from 'react';
import { extractChars } from '../engine/input';

interface Props {
  onChar(ch: string): void;
  onBackspace?(): void;
  onTab?(): void;
  onEscape?(): void;
  onFocusChange?(focused: boolean): void;
}

export function HiddenInput({ onChar, onBackspace, onTab, onEscape, onFocusChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(true);

  useEffect(() => { ref.current?.focus(); }, []);

  // While unfocused, a printable key refocuses the input; the browser then
  // delivers that same keystroke to it, so nothing is lost.
  useEffect(() => {
    if (focused) return;
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1) ref.current?.focus();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [focused]);

  const setF = (f: boolean) => { setFocused(f); onFocusChange?.(f); };

  return (
    <>
      <input
        ref={ref}
        className="hidden-input"
        aria-label="Typing input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onInput={(e) => {
          const ne = e.nativeEvent as InputEvent;
          for (const ch of extractChars(ne.data, ne.inputType)) onChar(ch);
          e.currentTarget.value = '';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') { e.preventDefault(); onBackspace?.(); }
          else if (e.key === 'Tab') { e.preventDefault(); onTab?.(); }
          else if (e.key === 'Escape') { onEscape?.(); }
        }}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
      />
      {!focused && (
        <div className="focus-overlay" onClick={() => ref.current?.focus()}>
          Click here or start typing
        </div>
      )}
    </>
  );
}
