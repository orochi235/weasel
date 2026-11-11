import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3 } from '@weasel-js/geom';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { runs, spread, tally } from './pbt.fixture';
import { resolveStrokeLengths, type StrokedPathCommand } from './strokeLengths';

const PATH = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
const PAINT = { kind: 'solid' as const, color: '#000' };
const px = spread(0.25, 64);
const scale = spread(-12, 12).map((e) => 2 ** e);

describe('resolveStrokeLengths, property', () => {
  it('resolves a { px } width to within an eighth of a screen pixel, and exactly with quantize off', () => {
    const t = tally();
    fc.assert(fc.property(px, scale, spread(-3.2, 3.2), (w, s, turn) => {
      const c = Math.cos(turn) * s, n = Math.sin(turn) * s;
      const m = mat3.fromAffine([c, n, -n, c, 17, -4]);
      const cmd = { kind: 'path', path: PATH, stroke: { paint: PAINT, width: { px: w } } } as StrokedPathCommand;
      const snapped = resolveStrokeLengths(m, cmd).cmd.stroke.width as number;
      const exact = resolveStrokeLengths(m, cmd, { quantize: false }).cmd.stroke.width as number;
      t.count(snapped === exact ? 'on the grid' : 'snapped');
      expect(Math.abs(snapped * s - w), `${snapped} at ${s}`).toBeLessThanOrEqual(1 / 8 + 1e-9 * w);
      expect(Math.abs(exact * s - w)).toBeLessThanOrEqual(1e-9 * w);
    }), runs(300));
    t.atLeast('snapped', 100);
  });

  it('quantizes onto a grid: a scale already snapped stays put, and powers of two land on it', () => {
    fc.assert(fc.property(px, scale, fc.integer({ min: -20, max: 20 }), (w, s, k) => {
      const q = quantizeStrokeScale(w, s);
      expect(Math.abs(quantizeStrokeScale(w, q) - q)).toBeLessThanOrEqual(1e-12 * q);
      expect(quantizeStrokeScale(w, 2 ** k)).toBe(2 ** k);
    }), runs(300));
  });

  it('leaves a world-sized stroke as it is', () => {
    fc.assert(fc.property(spread(0, 40), scale, (w, s) => {
      const cmd = { kind: 'path', path: PATH, stroke: { paint: PAINT, width: w } } as StrokedPathCommand;
      const got = resolveStrokeLengths(mat3.fromAffine([s, 0, 0, s, 0, 0]), cmd);
      expect(got.cmd).toBe(cmd);
      expect(got.spaces).toEqual({});
    }), runs(200));
  });
});
