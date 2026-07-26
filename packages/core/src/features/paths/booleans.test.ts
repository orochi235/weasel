import { describe, it, expect } from 'vitest';
import { pathUnion } from './booleans';
import { pointInPath } from './hitTest';
import type { RectPath, PolygonPath } from './types';
import { PATH_M, PATH_L, PATH_C, PATH_Z } from './types';

const r = (x: number, y: number, w: number, h: number): RectPath => ({
  kind: 'rect', x, y, width: w, height: h,
});

describe('pathUnion', () => {
  it('combines two overlapping rects into a single shape covering both', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(true);
    expect(pointInPath(u, 20, 20)).toBe(false);
  });

  it('disjoint inputs union to a multi-contour PolygonPath', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(false);
  });
});

import { pathIntersect } from './booleans';

describe('pathIntersect', () => {
  it('returns only the overlapping region of two overlapping rects', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const i = pathIntersect(a, b);
    expect(pointInPath(i, 7, 7)).toBe(true);
    expect(pointInPath(i, 2, 2)).toBe(false);
    expect(pointInPath(i, 12, 12)).toBe(false);
  });

  it('returns an empty path when inputs are disjoint', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const i = pathIntersect(a, b);
    expect(i.commands.length).toBe(0);
    expect(i.coords.length).toBe(0);
  });
});

import { pathSubtract } from './booleans';

describe('pathSubtract', () => {
  it('returns `a` with `b` punched out where they overlap', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const s = pathSubtract(a, b);
    expect(pointInPath(s, 2, 2)).toBe(true);
    expect(pointInPath(s, 7, 7)).toBe(false);
    expect(pointInPath(s, 12, 12)).toBe(false);
  });

  it('inner-contained subtract produces an annulus (multi-contour)', () => {
    const outer = r(0, 0, 20, 20);
    const inner = r(5, 5, 10, 10);
    const ann = pathSubtract(outer, inner);
    expect(pointInPath(ann, 2, 2)).toBe(true);
    expect(pointInPath(ann, 10, 10)).toBe(false);
    expect(pointInPath(ann, 25, 25)).toBe(false);
  });

  it('full subtraction produces an empty path', () => {
    const a = r(2, 2, 5, 5);
    const b = r(0, 0, 10, 10);
    const s = pathSubtract(a, b);
    expect(s.commands.length).toBe(0);
  });
});

import { pathExclude } from './booleans';

describe('pathExclude', () => {
  it('returns symmetric difference (in one or the other, not both)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const x = pathExclude(a, b);
    expect(pointInPath(x, 2, 2)).toBe(true);
    expect(pointInPath(x, 12, 12)).toBe(true);
    expect(pointInPath(x, 7, 7)).toBe(false);
  });
});

import { pathDivide } from './booleans';

describe('pathDivide', () => {
  it('two overlapping rects → three non-empty regions (A-only, B-only, A∩B)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(p.commands.length).toBeGreaterThan(0);
    }
    const inside = (path: PolygonPath, x: number, y: number) => pointInPath(path, x, y);
    const counts = [2, 7, 12].map((c) =>
      parts.filter((p) => inside(p, c, c)).length,
    );
    for (const k of counts) expect(k).toBe(1);
  });

  it('two disjoint rects → two regions (just the inputs)', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(2);
  });

  it('three rects with a triple overlap → 7 regions, every test point in exactly one', () => {
    // A: [0,20)×[0,20)  B: [10,30)×[0,20)  C: [5,25)×[10,30)
    // Triple overlap A∩B∩C lives at [10,20)×[10,20).
    const a = r(0, 0, 20, 20);
    const b = r(10, 0, 20, 20);
    const c = r(5, 10, 20, 20);
    const parts = pathDivide(a, b, c);
    expect(parts).toHaveLength(7);
    // 7 representative points, one per subset region.
    const probes: [number, number][] = [
      [2, 2],    // A only
      [25, 2],   // B only
      [22, 25],  // C only
      [15, 5],   // A∩B
      [7, 15],   // A∩C
      [22, 15],  // B∩C
      [15, 15],  // A∩B∩C
    ];
    for (const [x, y] of probes) {
      const hits = parts.filter((p) => pointInPath(p, x, y));
      expect(hits, `(${x},${y}) should land in exactly one region`).toHaveLength(1);
    }
  });
});

import { pathCrop } from './booleans';

describe('pathCrop', () => {
  it('clips each non-topmost path to the topmost (mask)', () => {
    // Two rects below; one mask on top covering only the right halves.
    const a = r(0, 0, 10, 10);
    const b = r(0, 10, 10, 10);
    const mask = r(5, 0, 20, 20);
    const cropped = pathCrop(a, b, mask);
    expect(cropped).toHaveLength(2);
    // Right halves survive; left halves are clipped away.
    expect(pointInPath(cropped[0], 7, 5)).toBe(true);
    expect(pointInPath(cropped[0], 2, 5)).toBe(false);
    expect(pointInPath(cropped[1], 7, 15)).toBe(true);
    expect(pointInPath(cropped[1], 2, 15)).toBe(false);
  });

  it('drops sources that lie entirely outside the mask', () => {
    const inside = r(0, 0, 5, 5);
    const outside = r(100, 100, 5, 5);
    const mask = r(0, 0, 10, 10);
    const cropped = pathCrop(inside, outside, mask);
    expect(cropped).toHaveLength(1);
    expect(pointInPath(cropped[0], 2, 2)).toBe(true);
  });

  it('returns [] when fewer than two inputs', () => {
    expect(pathCrop()).toEqual([]);
    expect(pathCrop(r(0, 0, 10, 10))).toEqual([]);
  });
});

describe('boolean ops — edge cases', () => {
  it('handles two rects touching at an edge (no spurious sliver)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(10, 0, 10, 10);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 15, 5)).toBe(true);
    expect(pointInPath(u, 25, 5)).toBe(false);
    expect(pointInPath(u, 5, 5)).toBe(true);
  });

  it('handles two rects touching at a single vertex', () => {
    const a = r(0, 0, 10, 10);
    const b = r(10, 10, 10, 10);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 5, 5)).toBe(true);
    expect(pointInPath(u, 15, 15)).toBe(true);
  });

  it('mixes RectPath and PolygonPath inputs without issue', () => {
    const rect = r(0, 0, 10, 10);
    const tri: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([5, 5, 15, 5, 10, 15]),
      fillRule: 'nonzero',
    };
    const u = pathUnion(rect, tri);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 8)).toBe(true);
  });

  it('flattens cubic beziers in inputs', () => {
    const bezier: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_C, PATH_L, PATH_Z]),
      coords: new Float32Array([
        0, 0,
        0, 10, 10, 10, 10, 0,
        0, 0,
      ]),
      fillRule: 'nonzero',
    };
    const u = pathUnion(bezier);
    expect(u.commands.length).toBeGreaterThan(0);
    expect(pointInPath(u, 5, 5)).toBe(true);
  });
});
