import { describe, it, expect } from 'vitest';
import { pathUnion, pathIntersect, pathSubtract, type GeomPath } from './index';
import { pointInPolygon } from '../polyline';
import { PATH_M, PATH_L, PATH_Z } from '../commands';

const rect = (x: number, y: number, w: number, h: number): GeomPath => ({ kind: 'rect', x, y, width: w, height: h });

// Collect every contour vertex of a polygon result into one interleaved ring
// for a coarse coverage check (results here are single-contour).
const ring = (p: GeomPath): number[] => {
  if (p.kind === 'rect') throw new Error('expected polygon');
  const out: number[] = [];
  for (let i = 0, ci = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i];
    if (cmd === PATH_M || cmd === PATH_L) { out.push(p.coords[ci], p.coords[ci + 1]); ci += 2; }
  }
  // `cmd === PATH_Z` carries no coords; referenced here to keep the import live.
  void PATH_Z;
  return out;
};

describe('pathUnion', () => {
  it('overlapping rects union to a shape covering both', () => {
    const u = pathUnion(rect(0, 0, 10, 10), rect(5, 5, 10, 10));
    const r = ring(u);
    expect(pointInPolygon(r, 2, 2)).toBe(true);
    expect(pointInPolygon(r, 12, 12)).toBe(true);
    expect(pointInPolygon(r, 20, 20)).toBe(false);
  });
});

describe('pathIntersect', () => {
  it('returns only the overlap of two overlapping rects', () => {
    const i = pathIntersect(rect(0, 0, 10, 10), rect(5, 5, 10, 10));
    const r = ring(i);
    expect(pointInPolygon(r, 7, 7)).toBe(true);
    expect(pointInPolygon(r, 2, 2)).toBe(false);
  });
});

describe('paths with holes', () => {
  // Outer square 0..100 with an opposite-wound 40..60 ring inside it.
  const donut: GeomPath = {
    kind: 'polygon',
    commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
    coords: Float64Array.of(0, 0, 100, 0, 100, 100, 0, 100, 40, 40, 40, 60, 60, 60, 60, 40),
    fillRule: 'nonzero',
  };

  const contours = (p: GeomPath): number[][] => {
    if (p.kind === 'rect') throw new Error('expected polygon');
    const out: number[][] = [];
    let cur: number[] = [];
    for (let i = 0, ci = 0; i < p.commands.length; i++) {
      const cmd = p.commands[i];
      if (cmd === PATH_M) { cur = [p.coords[ci], p.coords[ci + 1]]; out.push(cur); ci += 2; }
      else if (cmd === PATH_L) { cur.push(p.coords[ci], p.coords[ci + 1]); ci += 2; }
    }
    void PATH_Z;
    return out;
  };

  it('keeps a hole through a union that does not touch it', () => {
    const u = pathUnion(donut, rect(200, 200, 10, 10));
    const rings = contours(u);
    // outer + hole + the disjoint square
    expect(rings).toHaveLength(3);
    expect(rings.some((r) => pointInPolygon(r, 50, 50))).toBe(true);
  });

  it('keeps a hole through a subtract that does not touch it', () => {
    const s = pathSubtract(donut, rect(200, 200, 10, 10));
    expect(contours(s)).toHaveLength(2);
  });

  it('does not intersect anything inside the hole', () => {
    const i = pathIntersect(donut, rect(45, 45, 10, 10));
    expect(contours(i)).toHaveLength(0);
  });
});
