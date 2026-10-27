import { describe, it, expect } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { pathCropPieces, pathDividePieces, pathFacePieces, pathMerge, pathTrim, type MultiPolygon } from './index';
import { curveDivide, curveMerge, curveTrim, type CurvePiece } from './curvePieces';
import { PATH_L, PATH_M } from '../commands';
import type { Path, PolygonPath } from '../path';
import { area, circle, fine, hasCurves, mpArea, nearOutline, pointInPath, rect, rng, shape } from './curveShapes.fixtures';

const contours = (p: PolygonPath): number => p.commands.filter((c) => c === PATH_M).length;
const same = (a: PolygonPath, b: PolygonPath) => {
  expect([...a.commands]).toEqual([...b.commands]);
  expect([...a.coords]).toEqual([...b.coords]);
};

/** Area covered by exactly the inputs `sources` names, from the flattened clipper. */
function flatFaceArea(paths: readonly Path[], sources: readonly number[]): number {
  const mps = paths.map(fine);
  let r: MultiPolygon = polygonClipping.intersection(mps[sources[0]], ...sources.slice(1).map((i) => mps[i]));
  paths.forEach((_, i) => { if (!sources.includes(i)) r = polygonClipping.difference(r, mps[i]); });
  return mpArea(r);
}

describe('curve-preserving divide and face pieces', () => {
  it('divides two overlapping circles into three curved pieces with the clipper\'s areas', () => {
    const inputs = [circle(0, 0, 10), circle(12, 3, 8)];
    const pieces = pathDividePieces(...inputs);
    expect(curveDivide(inputs, false)).not.toBeNull();
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [0, 1]]);
    for (const p of pieces) {
      expect(hasCurves(p.path)).toBe(true);
      expect([...p.path.commands]).not.toContain(PATH_L);
      expect(area(p.path)).toBeCloseTo(flatFaceArea(inputs, p.sources), 1);
    }
  });

  it('gives back disjoint circles as their own cubics', () => {
    const inputs = [circle(0, 0, 10), circle(40, 0, 10)];
    const pieces = pathDividePieces(...inputs);
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1]]);
    same(pieces[0].path, inputs[0]);
    same(pieces[1].path, inputs[1]);
  });

  it('splits a circle cut through by a bar into two faces, and keeps a face\'s hole', () => {
    const cut = pathFacePieces(circle(0, 0, 10), rect(-2, -20, 4, 40));
    expect(cut.map((p) => p.sources)).toEqual([[0], [0], [1], [1], [0, 1]]);
    expect(pointInPath(cut[0].path, -6, 0)).toBe(true);
    expect(pointInPath(cut[1].path, 6, 0)).toBe(true);
    expect(hasCurves(cut[0].path)).toBe(true);

    const inner = circle(0, 0, 4);
    const ring = pathFacePieces(circle(0, 0, 10), inner);
    expect(ring.map((p) => p.sources)).toEqual([[0], [0, 1]]);
    expect(contours(ring[0].path)).toBe(2);
    expect(pointInPath(ring[0].path, 0, 0)).toBe(false);
    same(ring[1].path, inner);
  });

  it('divides a circle and a copy of it into one piece both cover, the circle itself', () => {
    const a = circle(0, 0, 10);
    const pieces = pathDividePieces(a, a);
    expect(pieces.map((p) => p.sources)).toEqual([[0, 1]]);
    same(pieces[0].path, a);
  });

  it('divides a circle and a semicircle sharing its arc into two curved pieces', () => {
    const a = circle(0, 0, 10);
    const lower = pathTrim(a, rect(-20, 0, 40, 20))[0].path;
    const pieces = pathDividePieces(a, lower);
    expect(pieces.map((p) => p.sources)).toEqual([[0], [0, 1]]);
    for (const p of pieces) {
      expect(hasCurves(p.path)).toBe(true);
      expect(area(p.path)).toBeCloseTo(area(a) / 2, 1);
    }
  });
});

describe('curve-preserving trim, merge and crop', () => {
  it('trims each circle by those in front of it, leaving the front one whole', () => {
    const inputs = [circle(0, 0, 10), circle(12, 0, 8), circle(6, 9, 6)];
    const pieces = pathTrim(...inputs);
    expect(curveTrim(inputs)).not.toBeNull();
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [2]]);
    same(pieces[2].path, inputs[2]);
    const mps = inputs.map(fine);
    expect(area(pieces[0].path)).toBeCloseTo(mpArea(polygonClipping.difference(mps[0], mps[1], mps[2])), 1);
    expect(area(pieces[1].path)).toBeCloseTo(mpArea(polygonClipping.difference(mps[1], mps[2])), 1);
  });

  it('drops a circle wholly hidden behind another', () => {
    expect(pathTrim(circle(0, 0, 4), circle(0, 0, 10)).map((p) => p.sources)).toEqual([[1]]);
  });

  it('merges same-key pieces into one curved path, naming the inputs showing in it', () => {
    const inputs = [circle(0, 0, 10), circle(12, 0, 8), circle(20, 0, 6), circle(50, 0, 3)];
    const pieces = pathMerge(inputs, (i) => (i === 1 ? 'blue' : 'red'));
    expect(curveMerge(inputs, (i) => (i === 1 ? 'blue' : 'red'))).not.toBeNull();
    expect(pieces.map((p) => p.sources)).toEqual([[1], [0, 2, 3]]);
    const red = pieces[1].path;
    expect(hasCurves(red)).toBe(true);
    expect(contours(red)).toBe(3);
    expect(pointInPath(red, -5, 0)).toBe(true);
    expect(pointInPath(red, 20, 0)).toBe(true);
    expect(pointInPath(red, 8, 0)).toBe(false);
  });

  it('is trim when every key differs', () => {
    const inputs = [circle(0, 0, 10), circle(12, 0, 8)];
    expect(pathMerge(inputs, (i) => i)).toEqual(pathTrim(...inputs));
  });

  it('crops circles to a circular mask with curves', () => {
    const inputs = [circle(0, 0, 10), circle(30, 0, 5), circle(8, 0, 6)];
    const pieces = pathCropPieces(...inputs);
    expect(pieces.map((p) => p.sources)).toEqual([[0]]);
    expect(hasCurves(pieces[0].path)).toBe(true);
    expect(area(pieces[0].path)).toBeCloseTo(mpArea(polygonClipping.intersection(fine(inputs[0]), fine(inputs[2]))), 1);
  });
});

/** The piece that holds (x, y), if exactly one does. */
function holder(pieces: readonly CurvePiece[], x: number, y: number): CurvePiece | null | 'several' {
  const hits = pieces.filter((p) => pointInPath(p.path, x, y));
  return hits.length > 1 ? 'several' : hits[0] ?? null;
}

describe('agreement with the flattened pieces on random shapes', () => {
  const TRIALS = 40;
  for (const grid of [false, true]) {
    it(`divides${grid ? ' on a grid' : ''}: every point lies in the piece naming the inputs that cover it`, () => {
      const r = rng(0xd1de + (grid ? 1 : 0));
      let curved = 0;
      for (let trial = 0; trial < TRIALS; trial++) {
        const inputs = [shape(r, grid), shape(r, grid), shape(r, grid)];
        const faces = curveDivide(inputs, true);
        const pieces = curveDivide(inputs, false);
        if (!faces || !pieces) continue;
        curved++;
        for (const p of pieces) {
          const want = flatFaceArea(inputs, p.sources);
          expect(Math.abs(area(p.path) - want), `trial ${trial} ${p.sources}`).toBeLessThan(0.5 + 0.002 * want);
        }
        for (let k = 0; k < 40; k++) {
          const x = -30 + r() * 100, y = -30 + r() * 100;
          if (inputs.some((p) => nearOutline(p, x, y))) continue;
          const want = inputs.flatMap((p, i) => (pointInPath(p, x, y) ? [i] : []));
          for (const set of [faces, pieces]) {
            const h = holder(set, x, y);
            expect(h === null || h === 'several' ? h : h.sources, `trial ${trial} at ${x},${y}`).toEqual(want.length ? want : null);
          }
        }
      }
      expect(curved).toBeGreaterThan(TRIALS * 0.9);
    });

    it(`trims${grid ? ' on a grid' : ''}: every point lies in the piece of the topmost input covering it`, () => {
      const r = rng(0x7a1d + (grid ? 1 : 0));
      let curved = 0;
      for (let trial = 0; trial < TRIALS; trial++) {
        const inputs = [shape(r, grid), shape(r, grid), shape(r, grid)];
        const pieces = curveTrim(inputs);
        if (!pieces) continue;
        curved++;
        const mps = inputs.map(fine);
        for (const p of pieces) {
          const i = p.sources[0];
          const want = mpArea(i === inputs.length - 1 ? mps[i] : polygonClipping.difference(mps[i], ...mps.slice(i + 1)));
          expect(Math.abs(area(p.path) - want), `trial ${trial} piece ${i}`).toBeLessThan(0.5 + 0.002 * want);
        }
        for (let k = 0; k < 40; k++) {
          const x = -30 + r() * 100, y = -30 + r() * 100;
          if (inputs.some((p) => nearOutline(p, x, y))) continue;
          const top = inputs.map((p) => pointInPath(p, x, y)).lastIndexOf(true);
          const h = holder(pieces, x, y);
          expect(h === null || h === 'several' ? h : h.sources[0], `trial ${trial} at ${x},${y}`).toEqual(top < 0 ? null : top);
        }
      }
      expect(curved).toBeGreaterThan(TRIALS * 0.9);
    });
  }
});
