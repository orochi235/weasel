import { describe, it, expect } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { pathFaceArrangement, type MultiPolygon } from './index';
import { PATH_L } from '../commands';
import type { Path, PolygonPath } from '../path';
import { area, circle, fine, hasCurves, mpArea, rect } from './curveShapes.fixtures';
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
