import { describe, expect, it } from 'vitest';
import { clusterSizes } from './text';

describe('clusterSizes', () => {
  it('treats ASCII as one code point per cluster', () => {
    expect(clusterSizes([...'cat'])).toEqual([1, 1, 1]);
  });
  it('groups Thai combining marks with their base', () => {
    expect(clusterSizes([...'ที่'])).toEqual([3]);
    expect(clusterSizes([...'ที่นี่'])).toEqual([3, 3]);
    expect(clusterSizes([...'กา'])).toEqual([1, 1]);
    expect(clusterSizes([...'เกม'])).toEqual([1, 1, 1]);
  });
});
