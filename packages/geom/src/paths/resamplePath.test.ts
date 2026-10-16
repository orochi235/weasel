import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { ellipsePath } from './builder';
import { isAnchorSmooth, pathToAnchors } from './anchors';
import { pathFromD } from './pathFromD';
import { pointAlongPath } from './pathAt';
import { pathDistanceToPoint } from './pathDistance';
import { arcRun } from './arcRun';
import { resamplePath } from './resamplePath';

function polygon(d: string): PolygonPath {
  const path = pathFromD(d);
  if (path.kind !== 'polygon') throw new Error('expected a polygon');
  return path;
}

/** The furthest any point sampled along `original` lies from `candidate`. */
function deviation(original: PolygonPath, candidate: PolygonPath, samples = 400): number {
  let max = 0;
  for (let i = 0; i <= samples; i++) {
    const p = pointAlongPath(original, i / samples, { flattenTolerance: 0.01 })!.point;
    max = Math.max(max, pathDistanceToPoint(candidate, p.x, p.y));
  }
  return max;
}

/** Arc-length gaps between consecutive anchors of the first subpath. */
function gaps(path: PolygonPath): number[] {
  const { anchors, closed } = pathToAnchors(path);
  const sub = anchors[0];
  const n = closed[0] ? sub.length : sub.length - 1;
  return Array.from({ length: n }, (_, i) => arcRun(sub, i, i + 1).length);
}

const WAVE = 'M 0 100 C 20 0 60 0 80 100 C 90 150 140 150 200 100 C 260 50 280 80 300 100';

describe('resamplePath', () => {
  it('spreads an open curve to the asked count at even spacing, within tolerance', () => {
    const src = polygon(WAVE);
    const out = resamplePath(src, { count: 9, keepCorners: false, tolerance: 0.5 });
    const { anchors } = pathToAnchors(out);
    expect(anchors[0]).toHaveLength(9);
    const g = gaps(out);
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    for (const v of g) expect(Math.abs(v - mean) / mean).toBeLessThan(0.02);
    expect(deviation(src, out)).toBeLessThan(0.5);
  });

  it('keeps the ends of an open subpath where they were', () => {
    const out = resamplePath(polygon(WAVE), { count: 5, keepCorners: false });
    const sub = pathToAnchors(out).anchors[0];
    expect([sub[0].x, sub[0].y]).toEqual([0, 100]);
    expect([sub.at(-1)!.x, sub.at(-1)!.y]).toEqual([300, 100]);
  });

  it('makes every new anchor smooth', () => {
    const out = resamplePath(polygon(WAVE), { count: 7, keepCorners: false });
    const sub = pathToAnchors(out).anchors[0];
    for (const a of sub.slice(1, -1)) expect(isAnchorSmooth(a)).toBe(true);
  });

  it('cuts runs by spacing', () => {
    const src = ellipsePath({ x: 0, y: 0, width: 200, height: 100 });
    const length = arcRun(pathToAnchors(src).anchors[0], 0, 4).length;
    const out = resamplePath(src, { spacing: 30, tolerance: 0.25 });
    expect(pathToAnchors(out).anchors[0]).toHaveLength(Math.round(length / 30));
    expect(deviation(src, out)).toBeLessThan(0.25);
  });

  it('holds corners fixed and resamples the runs between', () => {
    // A D shape: a straight back and a curved front, cornered where they meet.
    const src = polygon('M 0 0 C 80 0 120 40 120 100 C 120 160 80 200 0 200 Z');
    const out = resamplePath(src, { count: 8, tolerance: 0.25 });
    const sub = pathToAnchors(out).anchors[0];
    expect(sub).toHaveLength(8);
    expect(sub.some((a) => a.x === 0 && a.y === 0)).toBe(true);
    expect(sub.some((a) => a.x === 0 && a.y === 200)).toBe(true);
    expect(deviation(src, out)).toBeLessThan(0.25);
  });

  it('resamples over corners when told not to keep them, and still holds tolerance', () => {
    const src = polygon('M 0 0 L 100 0 L 100 100 L 0 100 Z');
    const out = resamplePath(src, { count: 8, keepCorners: false, tolerance: 0.5 });
    expect(deviation(src, out)).toBeLessThan(0.5);
    expect(pathToAnchors(out).anchors[0].length).toBeGreaterThanOrEqual(8);
  });

  it('keeps fill rules and leaves a path with nothing to change in place', () => {
    const src = { ...polygon('M 0 0 L 100 0 L 100 100 Z'), fillRule: 'evenodd' as const };
    const out = resamplePath(src, { count: 3 });
    expect(out.fillRule).toBe('evenodd');
    expect(Array.from(out.coords)).toEqual(Array.from(src.coords));
  });
});
