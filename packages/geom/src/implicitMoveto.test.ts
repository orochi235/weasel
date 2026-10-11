import { describe, expect, it } from 'vitest';
import { PATH_L } from './commands';
import { pathFromD } from './paths/pathFromD';
import { pointInPath } from './pathHitTest';
import { extractPolylines } from './tessellate/polyline';
import { tessellate } from './tessellate/tessellate';
import { pathToMultiPolygon } from './booleans/adapter';
import type { PolygonPath } from './path';

// SVG: after `z` the pen is back at the subpath's start, and a drawing
// command there opens a new subpath from it. So this is two triangles,
// (0,0) (10,0) (10,10) and (0,0) (-10,0) (-10,-10), each of area 50.
const TWO = pathFromD('M0 0 L10 0 L10 10 z l-10 0 l0 -10 z');

function meshArea(vertices: Float32Array, indices: Uint32Array): number {
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 2, indices[i + 1] * 2, indices[i + 2] * 2];
    area += Math.abs(
      (vertices[b] - vertices[a]) * (vertices[c + 1] - vertices[a + 1])
      - (vertices[c] - vertices[a]) * (vertices[b + 1] - vertices[a + 1]),
    ) / 2;
  }
  return area;
}

describe('a drawing command after Z with no M', () => {
  it('fills the second subpath for a hit test', () => {
    expect(pointInPath(TWO, 7, 3)).toBe(true);
    expect(pointInPath(TWO, -7, -3)).toBe(true);
    expect(pointInPath(TWO, -3, -7)).toBe(false);
  });

  it('starts a second polyline at the pen', () => {
    const lines = extractPolylines(TWO);
    expect(lines.map((l) => l.points)).toEqual([
      [0, 0, 10, 0, 10, 10],
      [0, 0, -10, 0, -10, -10],
    ]);
    expect(lines.map((l) => l.closed)).toEqual([true, true]);
    // The second contour's start is the first one's opening anchor.
    expect(Array.from(lines[1].anchorA!)).toEqual([0, 3, 4]);
    expect(Array.from(lines[1].anchorT!)).toEqual([0, 0, 0]);
  });

  it('triangulates two triangles, not one pentagon', () => {
    const mesh = tessellate(TWO);
    expect(mesh.vertices).toHaveLength(12);
    expect(meshArea(mesh.vertices, mesh.indices)).toBeCloseTo(100, 6);
  });

  it('keeps the second ring for boolean ops', () => {
    const polys = pathToMultiPolygon(TWO);
    expect(polys).toHaveLength(2);
    const rings = polys.map((p) => p[0].map(([x, y]) => `${x},${y}`).sort());
    expect(rings).toContainEqual(['-10,-10', '-10,0', '0,0', '0,0']);
  });

  it('starts a curve after Z from the subpath start, in a ring', () => {
    // Pen returns to (10,10); the curve runs from there, never from (20,20).
    const polys = pathToMultiPolygon(pathFromD('M10 10 L20 10 L20 20 Z Q0 0 0 10 Z'));
    expect(polys).toHaveLength(2);
    const second = polys.find((p) => p[0].some(([x]) => x < 10))!;
    expect(second[0][0]).toEqual([10, 10]);
    expect(Math.max(...second[0].map(([x]) => x))).toBe(10);
  });
});

describe('a path with no opening M', () => {
  const bare: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_L, PATH_L]),
    coords: new Float32Array([10, 10, 20, 0]),
    fillRule: 'nonzero',
  };

  it('strokes from the origin instead of throwing', () => {
    expect(extractPolylines(bare).map((l) => l.points)).toEqual([[0, 0, 10, 10, 20, 0]]);
  });

  it('tessellates as one contour', () => {
    expect(meshArea(tessellate(bare).vertices, tessellate(bare).indices)).toBeCloseTo(100, 6);
  });
});
