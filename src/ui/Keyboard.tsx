import { useMemo } from 'react';
import { keyFor, layoutRows, type KeyCap, type Lang } from '../engine/keyboard';

interface Props { lang: Lang; nextChar?: string | null; heat?: Record<string, number> }

function heatColor(rate: number): string {
  const pct = Math.round(Math.min(1, rate / 0.3) * 100);
  return `color-mix(in srgb, var(--error) ${pct}%, var(--key-bg))`;
}

function Key({ cap, active, heat }: { cap: KeyCap; active: boolean; heat?: number }) {
  const space = cap.id === 'space';
  return (
    <div
      className={`key${active ? ' key-next' : ''}`}
      style={{ flexGrow: cap.width ?? 1, background: heat !== undefined ? heatColor(heat) : undefined }}
      title={heat !== undefined ? `${Math.round(heat * 100)}% errors` : undefined}
    >
      <span className="key-shift">{space ? '' : cap.shifted}</span>
      <span>{space ? 'space' : cap.base}</span>
    </div>
  );
}

export function Keyboard({ lang, nextChar, heat }: Props) {
  const rows = layoutRows(lang);
  const next = nextChar ? keyFor(lang, nextChar) : null;
  const heatById = useMemo(() => {
    const m: Record<string, number> = {};
    if (heat) {
      for (const [ch, v] of Object.entries(heat)) {
        const k = keyFor(lang, ch);
        if (k) m[k.id] = Math.max(m[k.id] ?? 0, v);
      }
    }
    return m;
  }, [heat, lang]);

  return (
    <div className="keyboard" aria-hidden>
      {rows.map((row, r) => (
        <div className="kb-row" key={r}>
          {r === 3 && <div className={`key key-mod${next?.shift ? ' key-next' : ''}`}>shift</div>}
          {row.map((cap) => (
            <Key key={cap.id} cap={cap} active={next?.id === cap.id} heat={heat ? heatById[cap.id] : undefined} />
          ))}
          {r === 3 && <div className={`key key-mod${next?.shift ? ' key-next' : ''}`}>shift</div>}
        </div>
      ))}
    </div>
  );
}
