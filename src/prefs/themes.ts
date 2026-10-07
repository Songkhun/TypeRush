export type ThemeId = 'neon' | 'matrix' | 'sunset' | 'ocean' | 'mono';

export interface Palette { correct: string; error: string; combo: string; accent: string; text: string; muted: string }

/** Page background every theme is drawn on. */
export const BG = '#0b0f1a';

export const THEME_IDS: ThemeId[] = ['neon', 'matrix', 'sunset', 'ocean', 'mono'];

export const THEMES: Record<ThemeId, { name: string; palette: Palette }> = {
  neon: { name: 'Neon', palette: { correct: '#22d3ee', error: '#f472b6', combo: '#fbbf24', accent: '#a78bfa', text: '#c9d1e0', muted: '#6b7799' } },
  matrix: { name: 'Matrix', palette: { correct: '#4ade80', error: '#f87171', combo: '#facc15', accent: '#22c55e', text: '#bbf7d0', muted: '#5f8f6b' } },
  sunset: { name: 'Sunset', palette: { correct: '#fb923c', error: '#fb7185', combo: '#fde047', accent: '#f472b6', text: '#fed7aa', muted: '#8f7468' } },
  ocean: { name: 'Ocean', palette: { correct: '#38bdf8', error: '#fb7185', combo: '#5eead4', accent: '#818cf8', text: '#cbd5e1', muted: '#64748b' } },
  mono: { name: 'Mono', palette: { correct: '#f8fafc', error: '#fca5a5', combo: '#e2e8f0', accent: '#94a3b8', text: '#cbd5e1', muted: '#6b7280' } },
};

export function paletteFor(id: ThemeId): Palette {
  return (THEMES[id] ?? THEMES.neon).palette;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
