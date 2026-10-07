import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStorage, load, save, type FxIntensity, type SaveData } from '../store/storage';
import { Sound } from '../fx/sound';
import { effectiveIntensity, prefersReducedMotion } from '../fx/motion';

interface AppCtx { data: SaveData; commit: (next: SaveData) => void; sound: Sound; intensity: FxIntensity }

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SaveData>(() => load(getStorage()));
  const sound = useMemo(() => new Sound(), []);
  sound.enabled = data.settings.sound;
  const intensity = effectiveIntensity(data.settings.fxIntensity, prefersReducedMotion());

  useEffect(() => { document.body.dataset.fx = intensity; }, [intensity]);

  const value = useMemo<AppCtx>(() => ({
    data, sound, intensity,
    commit: (next) => { setData(next); save(next, getStorage()); },
  }), [data, sound, intensity]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
