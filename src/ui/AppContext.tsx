import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStorage, load, save, type FxIntensity, type SaveData } from '../store/storage';
import { Sound } from '../fx/sound';
import { effectiveIntensity, prefersReducedMotion } from '../fx/motion';
import { fontFor } from '../prefs/fonts';
import { paletteFor, type Palette } from '../prefs/themes';

interface AppCtx {
  data: SaveData;
  commit: (next: SaveData) => void;
  sound: Sound;
  intensity: FxIntensity;
  palette: Palette;
  /** CSS font-family stack for the chosen font (also used by the arcade canvas). */
  fontStack: string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SaveData>(() => load(getStorage()));
  const { settings } = data;
  const sound = useMemo(() => new Sound(), []);
  sound.enabled = settings.sound;
  sound.volume = settings.volume;
  sound.pack = settings.soundPack;
  const intensity = effectiveIntensity(settings.fxIntensity, prefersReducedMotion());
  const palette = paletteFor(settings.theme);
  const font = fontFor(settings.font);

  useEffect(() => { document.body.dataset.fx = intensity; }, [intensity]);

  useEffect(() => {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(palette)) root.setProperty(`--${k}`, v);
    root.setProperty('--font-mono', font.stack);
    root.setProperty('--font-th', `"${font.thai}", sans-serif`);
    root.setProperty('--type-size', `${settings.fontSize}rem`);
  }, [palette, font, settings.fontSize]);

  const value = useMemo<AppCtx>(() => ({
    data, sound, intensity, palette, fontStack: font.stack,
    commit: (next) => { setData(next); save(next, getStorage()); },
  }), [data, sound, intensity, palette, font]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
