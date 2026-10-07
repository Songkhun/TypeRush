import type { SessionRecord } from '../store/storage';

const W = 600, H = 220, PAD = 30;

export function LineChart({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) {
    return <p className="muted">Finish a couple of tests to see your progress chart.</p>;
  }
  const maxWpm = Math.max(20, Math.ceil(Math.max(...sessions.map((s) => s.wpm)) / 20) * 20);
  const x = (i: number) => PAD + (i / (sessions.length - 1)) * (W - PAD * 2);
  const yW = (v: number) => H - PAD - (v / maxWpm) * (H - PAD * 2);
  const yA = (v: number) => H - PAD - v * (H - PAD * 2);
  const wpmPts = sessions.map((s, i) => `${x(i)},${yW(s.wpm)}`).join(' ');
  const accPts = sessions.map((s, i) => `${x(i)},${yA(s.acc)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="WPM and accuracy over time">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD} x2={W - PAD} y1={yA(f)} y2={yA(f)} style={{ stroke: 'var(--line)' }} />
          <text x={4} y={yA(f) + 4} style={{ fill: 'var(--muted)' }} fontSize="11">{Math.round(maxWpm * f)}</text>
        </g>
      ))}
      <polyline points={accPts} fill="none" style={{ stroke: 'var(--combo)' }} strokeWidth="1.5" strokeDasharray="4 4" />
      <polyline points={wpmPts} fill="none" style={{ stroke: 'var(--correct)' }} strokeWidth="2.5" />
      {sessions.map((s, i) => <circle key={i} cx={x(i)} cy={yW(s.wpm)} r="3" style={{ fill: 'var(--correct)' }} />)}
      <text x={W - PAD} y={16} textAnchor="end" fontSize="12" style={{ fill: 'var(--correct)' }}>— WPM</text>
      <text x={W - PAD} y={32} textAnchor="end" fontSize="12" style={{ fill: 'var(--combo)' }}>- - accuracy</text>
    </svg>
  );
}
