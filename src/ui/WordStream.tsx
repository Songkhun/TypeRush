import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { clusterView, type TypingState, type WordState } from '../engine/typing';

function Word({ w, done, current, spanRef }: { w: WordState; done: boolean; current: boolean; spanRef?: Ref<HTMLSpanElement> }) {
  const clusters = clusterView(w, done);
  const caret = current ? clusters.findIndex((c) => c.state === 'pending' || c.state === 'partial') : -2;
  const caretAtEnd = current && caret === -1;
  const lastTyped = current ? (caret === -1 ? clusters.length - 1 : caret - 1) : -1;
  const wrong = done && w.typed.join('') !== w.target.join('');
  return (
    <span ref={spanRef} className={`word${wrong ? ' word-wrong' : ''}`}>
      {clusters.map((c, i) => (
        <span
          key={i === lastTyped ? `${i}-${w.typed.length}` : i}
          className={`ch ch-${c.state}${i === caret ? ' caret' : ''}${i === lastTyped && c.state === 'correct' ? ' just' : ''}`}
        >
          {c.text}
        </span>
      ))}
      {caretAtEnd && <span className="ch caret caret-end" />}
    </span>
  );
}

export function WordStream({ state }: { state: TypingState }) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const a = activeRef.current;
    if (!a) return;
    setOffset(Math.max(0, a.offsetTop - a.offsetHeight));
  }, [state.wordIndex]);

  return (
    <div className="stream">
      <div className="stream-inner" style={{ transform: `translateY(${-offset}px)` }}>
        {state.words.map((w, i) => (
          <Word
            key={i}
            w={w}
            done={i < state.wordIndex}
            current={i === state.wordIndex}
            spanRef={i === state.wordIndex ? activeRef : undefined}
          />
        ))}
      </div>
    </div>
  );
}
