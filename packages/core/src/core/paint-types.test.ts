import { describe, it, expect } from 'vitest';
import {
  dashForStrokeStyle,
  strokeDashStyleOf,
  STROKE_DASH_RATIOS,
} from './paint-types';

describe('stroke dash styles', () => {
  it('scales a preset by the stroke width', () => {
    expect(dashForStrokeStyle('dashed', 1)).toEqual([3, 2]);
    expect(dashForStrokeStyle('dashed', 4)).toEqual([12, 8]);
    expect(dashForStrokeStyle('dotted', 2)).toEqual([2, 4]);
  });

  it('stores solid as no dash at all', () => {
    expect(dashForStrokeStyle('solid', 4)).toBeUndefined();
  });

  it('has no array for custom', () => {
    expect(dashForStrokeStyle('custom', 4)).toBeUndefined();
  });

  it('reads a `{ px }` width at scale 1, and a missing one as 1', () => {
    expect(dashForStrokeStyle('dashed', { px: 4 })).toEqual([12, 8]);
    expect(dashForStrokeStyle('dashed', undefined)).toEqual([3, 2]);
  });

  it('round-trips every preset at every width', () => {
    for (const style of ['dashed', 'dotted'] as const) {
      for (const width of [0.5, 1, 3, 7.25, 20]) {
        expect(strokeDashStyleOf(dashForStrokeStyle(style, width), width)).toBe(style);
      }
    }
  });

  it('reads an absent or empty dash as solid', () => {
    expect(strokeDashStyleOf(undefined, 4)).toBe('solid');
    expect(strokeDashStyleOf([], 4)).toBe('solid');
    expect(strokeDashStyleOf([0, 0], 4)).toBe('solid');
  });

  it('reads an array matching no preset as custom', () => {
    expect(strokeDashStyleOf([9, 1, 2, 1], 4)).toBe('custom');
    expect(strokeDashStyleOf([5, 5], 4)).toBe('custom');
  });

  // The whole point of scaling: the same array is a different style at a
  // different width, and a control that ignored the width would report one
  // of them wrongly.
  it('reads the same array as a different style at a different width', () => {
    const dashedAt4 = dashForStrokeStyle('dashed', 4)!;
    expect(strokeDashStyleOf(dashedAt4, 4)).toBe('dashed');
    expect(strokeDashStyleOf(dashedAt4, 1)).toBe('custom');
  });

  it('tolerates the decimal trimming a round trip through SVG applies', () => {
    const w = 7 / 3;
    const trimmed = STROKE_DASH_RATIOS.dashed.map((r) => Math.round(r * w * 1000) / 1000);
    expect(strokeDashStyleOf(trimmed, w)).toBe('dashed');
  });
});
