import { describe, it, expect } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { pathFaceArrangement, type MultiPolygon } from './index';
import { PATH_L } from '../commands';
import type { Path, PolygonPath } from '../path';
import { area, circle, fine, hasCurves, mpArea, rect, rng, shape } from './curveShapes.fixtures';
import { curveFaces, type CurveFaceSet } from './curveFaces';
import { parseContours } from './contours';
import { intersectSegments } from '../intersect/segmentIntersections';
import { DIGITS, glyphCell } from './glyphCell.fixture';

/** One path drawing both of `a`'s and `b`'s contours. */
const both = (a: PolygonPath, b: PolygonPath): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([...a.commands, ...b.commands]),
  coords: new Float32Array([...a.coords, ...b.coords]),
  fillRule: 'nonzero',
});

const unionArea = (paths: readonly Path[]): number => {
  const mps: MultiPolygon[] = paths.map(fine);
  return mpArea(polygonClipping.union(mps[0], ...mps.slice(1)));
};

describe('pathFaceArrangement', () => {
  it('cuts two overlapping circles into three curved faces and says which touch', () => {
    const { faces, neighbors } = pathFaceArrangement([circle(0, 0, 10), circle(12, 0, 8)]);
    expect(faces.map((f) => f.sources)).toEqual([[0], [1], [0, 1]]);
    for (const f of faces) {
      expect(hasCurves(f.path)).toBe(true);
      expect([...f.path.commands]).not.toContain(PATH_L);
    }
    expect(neighbors.map((n) => [n.a, n.b])).toEqual([[-1, 0], [-1, 1], [0, 2], [1, 2]]);
    // Each arc of the lens is shared by the lens and one crescent; the two arcs' lengths add to its perimeter.
    const lens = neighbors.filter((n) => n.b === 2).reduce((s, n) => s + n.length, 0);
    const x = (100 - 64 + 144) / 24, y = Math.sqrt(100 - x * x);
    const perimeter = 2 * 10 * Math.asin(y / 10) + 2 * 8 * Math.asin(y / 8);
    expect(lens).toBeCloseTo(perimeter, 2);
  });

  it('keeps faces the same inputs cover apart, and gives each its own neighbors', () => {
    const { faces, neighbors } = pathFaceArrangement([rect(0, 0, 30, 10), rect(10, -5, 10, 20)]);
    expect(faces.map((f) => f.sources)).toEqual([[0], [0], [1], [1], [0, 1]]);
    const shared = (a: number, b: number) => neighbors.find((n) => n.a === a && n.b === b)?.length;
    expect(shared(0, 4)).toBeCloseTo(10);
    expect(shared(1, 4)).toBeCloseTo(10);
    expect(shared(0, 1)).toBeUndefined();
    expect(shared(-1, 0)).toBeCloseTo(30);
  });

  it('makes one face of a path whose own contours overlap', () => {
    const { faces, neighbors } = pathFaceArrangement([both(circle(0, 0, 10), circle(8, 0, 10))]);
    expect(faces.map((f) => f.sources)).toEqual([[0]]);
    expect(neighbors.map((n) => [n.a, n.b])).toEqual([[-1, 0]]);
    expect(area(faces[0].path)).toBeCloseTo(unionArea([circle(0, 0, 10), circle(8, 0, 10)]), 0);
  });

  it('keeps a face\'s hole, and a face inside the hole', () => {
    const { faces, neighbors } = pathFaceArrangement([circle(0, 0, 20), circle(0, 0, 10), rect(-2, -2, 4, 4)]);
    expect(faces.map((f) => f.sources)).toEqual([[0], [0, 1], [0, 1, 2]]);
    expect(area(faces[0].path)).toBeCloseTo(Math.PI * 300, -1);
    expect(neighbors.map((n) => [n.a, n.b])).toEqual([[-1, 0], [0, 1], [1, 2]]);
  });

  it('cuts glyphs overlaid in one cell into faces that tile what they cover', () => {
    const glyphs = glyphCell(DIGITS);
    const { faces, neighbors } = pathFaceArrangement(glyphs);
    expect(faces.length).toBeGreaterThan(500);
    const total = faces.reduce((s, f) => s + area(f.path), 0);
    expect(total).toBeCloseTo(unionArea(glyphs), 0);
    expect(faces.filter((f) => hasCurves(f.path)).length).toBeGreaterThan(faces.length / 2);
    for (const n of neighbors) {
      expect(n.a).toBeLessThan(n.b);
      expect(n.length).toBeGreaterThan(0);
    }
  });

  it('answers nothing for no inputs', () => {
    expect(pathFaceArrangement([])).toEqual({ faces: [], neighbors: [] });
  });
});

/** What a polish must not change: the faces, their covers, and who neighbors whom. */
const topology = (set: CurveFaceSet) => ({
  covers: set.faces.map((f) => f.sources.join(',')),
  loops: set.faces.map((f) => f.loops.map((l) => l.length)),
  neighbors: set.neighbors.map((n) => [n.a, n.b, n.length]),
});

describe('polishing crossings onto the curves', () => {
  it('moves two circles\' crossings onto the curves\' own crossings', () => {
    const inputs = [circle(0, 0, 10), circle(12, 0, 8)];
    const [ca, cb] = inputs.map((p) => parseContours(p).flat());
    const exact = ca.flatMap((s) => cb.flatMap((t) => intersectSegments(s, t)));
    expect(exact.length).toBe(2);
    const gap = (set: CurveFaceSet) => Math.max(...exact.map((h) =>
      Math.min(...set.faces[2].loops[0].map((s) => Math.hypot(s[0].x - h.x, s[0].y - h.y)))));
    const on = curveFaces(inputs);
    expect(on.polish).toMatchObject({ crossings: 2, polished: 2 });
    expect(gap(on)).toBeLessThan(1e-9);
    expect(gap(curveFaces(inputs, undefined, false))).toBeGreaterThan(1e-7);
  });

  it('leaves the faces, their covers, and their neighbors as the flattening cut them', () => {
    const next = rng(0x9011);
    let polished = 0;
    for (let trial = 0; trial < 20; trial++) {
      const inputs = [shape(next), shape(next), shape(next), shape(next)];
      const on = curveFaces(inputs), off = curveFaces(inputs, undefined, false);
      expect(topology(on), `trial ${trial}`).toEqual(topology(off));
      polished += on.polish.polished;
    }
    expect(polished).toBeGreaterThan(0);
  });

  it('leaves glyphs overlaid in one cell cut as before, and moves no crossing past what the flattening can misplace', () => {
    const glyphs = glyphCell(DIGITS);
    const on = curveFaces(glyphs), off = curveFaces(glyphs, undefined, false);
    expect(topology(on)).toEqual(topology(off));
    expect(on.polish.polished).toBeGreaterThan(on.polish.crossings * 0.8);
    // Each move stays within 1.05 · 2 · tolerance / sin θ of its chords, and the sine floor of 0.05 caps that.
    expect(on.polish.largestShare).toBeGreaterThan(0);
    expect(on.polish.largestShare).toBeLessThanOrEqual(1);
    const tolerance = 1e-5 * Math.hypot(100, 100);
    expect(on.polish.largestMove).toBeLessThanOrEqual((1.05 * 2 * tolerance) / 0.05);
  });
});
