export const COMBO_TIERS = [10, 25, 50, 100];

export function comboTier(combo: number): number {
  return COMBO_TIERS.filter((t) => combo >= t).length;
}
