import { describe, it, expect } from 'vitest';
import { DEFAULT_FLATTEN_TOLERANCE, type GlMat3 } from '@weasel-js/geom';
import { worldFlattenTolerance } from './flattenTolerance';

const scale = (sx: number, sy = sx): GlMat3 => new Float64Array([sx, 0, 0, 0, sy, 0, 0, 0, 1]);
const rotated = (s: number, rad: number): GlMat3 => {
  const c = Math.cos(rad) * s;
  const n = Math.sin(rad) * s;
  return new Float64Array([c, n, 0, -n, c, 0, 0, 0, 1]);
};

describe('worldFlattenTolerance', () => {
  it('passes a world tolerance through untouched', () => {
    expect(worldFlattenTolerance(0.01, scale(8))).toBe(0.01);
  });

  it('defaults to half a pixel, which is the cached default at identity', () => {
    expect(worldFlattenTolerance(undefined, scale(1))).toBe(DEFAULT_FLATTEN_TOLERANCE);
  });

  it('divides a pixel tolerance by the scale', () => {
    expect(worldFlattenTolerance({ px: 0.5 }, scale(8))).toBe(0.0625);
    expect(worldFlattenTolerance({ px: 0.5 }, scale(1 / 4))).toBe(2);
  });

  it('snaps down to a power of two, so a continuous zoom keeps its key within an octave', () => {
    const at = (s: number): number => worldFlattenTolerance({ px: 0.5 }, scale(s));
    expect(at(3)).toBe(0.125);
    expect(at(2.1)).toBe(at(3.9));
    expect(at(3.9)).toBeLessThanOrEqual(0.5 / 3.9);
  });

  it('measures the most stretched direction', () => {
    expect(worldFlattenTolerance({ px: 0.5 }, scale(1, 8))).toBe(0.0625);
    expect(worldFlattenTolerance({ px: 0.5 }, rotated(8, 0.7))).toBe(0.0625);
  });

  it('falls back to the default under a transform that collapses', () => {
    expect(worldFlattenTolerance({ px: 0.5 }, scale(0))).toBe(DEFAULT_FLATTEN_TOLERANCE);
    expect(worldFlattenTolerance({ px: 0.5 }, scale(Infinity))).toBe(DEFAULT_FLATTEN_TOLERANCE);
  });
});
