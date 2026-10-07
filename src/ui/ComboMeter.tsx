import type { Ref } from 'react';
import { comboTier } from '../fx/combo';

export function ComboMeter({ combo, spanRef }: { combo: number; spanRef?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={spanRef} className={`combo combo-t${comboTier(combo)}`}>
      {combo > 1 ? `${combo}× combo` : ''}
    </span>
  );
}
