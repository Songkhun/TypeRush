import type { FxIntensity } from '../store/storage';

export function effectiveIntensity(setting: FxIntensity, reducedMotion: boolean): FxIntensity {
  return reducedMotion ? 'off' : setting;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
