const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });

/** Number of code points in each grapheme cluster of the given code points. */
export function clusterSizes(cps: readonly string[]): number[] {
  return [...segmenter.segment(cps.join(''))].map((seg) => [...seg.segment].length);
}
