import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { pathToAnchors } from './anchors';
import { boundsOfPath } from './bounds';
import { linePath, polygonFromPoints, rectPath } from './builder';
import { puckerBloatPath } from './puckerBloatPath';
import { roughenPath, type RoughenPathOptions } from './roughenPath';
import { zigzagPath } from './zigzagPath';

const square = (): PolygonPath => polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
const anchorsOf = (p: unknown) => pathToAnchors(p as PolygonPath).anchors;
const points = (p: unknown) => anchorsOf(p).flat();
const distFromCenter = (a: { x: number; y: number }) => Math.hypot(a.x - 50, a.y - 50);

describe('roughenPath', () => {
  const roughen = (opts: Partial<RoughenPathOptions>) => roughenPath(square(), { size: 6, detail: 3, ...opts }) as PolygonPath;

  it('answers the path itself at no size', () => {
    const p = square();
    expect(roughenPath(p, { size: 0 })).toBe(p);
  });

  it('adds detail points to each segment and moves every point by at most size on each axis', () => {
    const out = points(roughen({ seed: 1 }));
    expect(out).toHaveLength(4 * 4);
    const along = points(roughen({ size: 1e-9 }));
    out.forEach((p, i) => {
      expect(Math.abs(p.x - along[i]!.x)).toBeLessThanOrEqual(6);
      expect(Math.abs(p.y - along[i]!.y)).toBeLessThanOrEqual(6);
    });
  });

  it('roughens the same way for the same seed, and differently for another', () => {
    expect(Array.from(roughen({ seed: 7 }).coords)).toEqual(Array.from(roughen({ seed: 7 }).coords));
    expect(Array.from(roughen({ seed: 7 }).coords)).not.toEqual(Array.from(roughen({ seed: 8 }).coords));
  });

  it('reads a rect as its four corners', () => {
    expect(points(roughenPath(rectPath(0, 0, 100, 100), { size: 2, detail: 0 }))).toHaveLength(4);
  });
});

describe('zigzagPath', () => {
  it('pushes the points alternately to either side of the outline', () => {
    const out = points(zigzagPath(square(), { size: 5, ridges: 1 }));
    // The top edge runs left to right, so its normal points down.
    expect(out.slice(0, 2)).toEqual([{ x: 0, y: 5 }, { x: 50, y: -5 }]);
    expect(out).toHaveLength(8);
  });

  it('runs a curve through the points when smooth', () => {
    const [anchors] = anchorsOf(zigzagPath(square(), { size: 5, ridges: 2, smooth: true }));
    expect(anchors).toHaveLength(12);
    expect(anchors!.every((a) => a.inHandle && a.outHandle)).toBe(true);
  });

  it('ends an open path on its last point', () => {
    const out = points(zigzagPath(linePath({ x: 0, y: 0 }, { x: 100, y: 0 }), { size: 5, ridges: 1 }));
    expect(out).toEqual([{ x: 0, y: 5 }, { x: 50, y: -5 }, { x: 100, y: 5 }]);
  });
});

describe('puckerBloatPath', () => {
  it('bloats: anchors move toward the center and handles away from it', () => {
    const [out] = anchorsOf(puckerBloatPath(square(), { amount: 0.5 }));
    expect(distFromCenter(out![0]!)).toBeCloseTo(Math.hypot(50, 50) * 0.75);
    expect(distFromCenter(out![0]!.outHandle!)).toBeGreaterThan(distFromCenter({ x: 100 / 3, y: 0 }));
  });

  it('puckers: anchors move away from the center and handles toward it', () => {
    const out = puckerBloatPath(square(), { amount: -0.5 });
    const [anchors] = anchorsOf(out);
    expect(distFromCenter(anchors![0]!)).toBeCloseTo(Math.hypot(50, 50) * 1.25);
    expect(distFromCenter(anchors![0]!.outHandle!)).toBeLessThan(distFromCenter({ x: 100 / 3, y: 0 }));
    expect(boundsOfPath(out).width).toBeGreaterThan(100);
  });

  it('reads a rect as its four corners', () => {
    expect(anchorsOf(puckerBloatPath(rectPath(0, 0, 100, 100), { amount: 0.5 }))[0]).toHaveLength(4);
  });
});
