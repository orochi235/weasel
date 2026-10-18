import { describe, expect, it } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { pathToMultiPolygon, type MultiPolygon, type Ring } from './adapter';
import { pathFacePieces } from './ops';
import type { Path, PolygonPath } from '../path';
import { PATH_C, PATH_L, PATH_M, PATH_Z } from '../commands';

/** The subset-by-subset clipping `pathFacePieces` used before it traced the arrangement. */
function oracleFaces(paths: Path[]): Map<string, MultiPolygon> {
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const n = mps.length;
  const out = new Map<string, MultiPolygon>();
  for (let mask = 1; mask < 1 << n; mask++) {
    const inside: MultiPolygon[] = [];
    const outside: MultiPolygon[] = [];
    const sources: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sources.push(i);
      (mask & (1 << i) ? inside : outside).push(mps[i]!);
    }
    const [head, ...rest] = inside;
    let region = rest.length === 0 ? polygonClipping.union(head!) : polygonClipping.intersection(head!, ...rest);
    if (outside.length > 0 && region.length > 0) {
      const [oh, ...or] = outside;
      region = polygonClipping.difference(region, polygonClipping.union(oh!, ...or));
    }
    if (region.length > 0) out.set(sources.join(','), region);
  }
  return out;
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let k = 0; k + 1 < ring.length; k++) a += ring[k]![0] * ring[k + 1]![1] - ring[k + 1]![0] * ring[k]![1];
  return a / 2;
}

function area(mp: MultiPolygon): number {
  return mp.reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)), 0), 0);
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function polygonPath(pts: [number, number][]): PolygonPath {
  const commands = new Uint8Array(pts.length + 1);
  commands.fill(PATH_L);
  commands[0] = PATH_M;
  commands[pts.length] = PATH_Z;
  return { kind: 'polygon', commands, coords: new Float32Array(pts.flat()), fillRule: 'nonzero' };
}

function circlePath(cx: number, cy: number, r: number): PolygonPath {
  const k = 0.5523 * r;
  const coords = [
    cx + r, cy,
    cx + r, cy + k, cx + k, cy + r, cx, cy + r,
    cx - k, cy + r, cx - r, cy + k, cx - r, cy,
    cx - r, cy - k, cx - k, cy - r, cx, cy - r,
    cx + k, cy - r, cx + r, cy - k, cx + r, cy,
  ];
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_C, PATH_C, PATH_C, PATH_C, PATH_Z]),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
}

/** A shape at random: a box, a star, a triangle or a circle. */
function shape(next: () => number): Path {
  const cx = next() * 100, cy = next() * 100;
  const s = 10 + next() * 40;
  switch (Math.floor(next() * 4)) {
    case 0: return { kind: 'rect', x: cx, y: cy, width: s, height: s * (0.3 + next()) };
    case 1: {
      const pts: [number, number][] = [];
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + next() * 0.1, r = k % 2 ? s * 0.4 : s;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return polygonPath(pts);
    }
    case 2: return polygonPath([[cx, cy], [cx + s, cy + next() * 10], [cx + next() * s, cy + s]]);
    default: return circlePath(cx, cy, s / 2);
  }
}

describe('pathFacePieces against subset clipping', () => {
  for (let seed = 1; seed <= 24; seed++) {
    it(`gives the same faces for random shapes, seed ${seed}`, () => {
      const next = rng(seed);
      const paths = Array.from({ length: 2 + (seed % 5) }, () => shape(next));
      const oracle = oracleFaces(paths);
      const got = new Map<string, MultiPolygon>();
      for (const piece of pathFacePieces(...paths)) {
        const key = piece.sources.join(',');
        got.set(key, [...(got.get(key) ?? []), ...pathToMultiPolygon(piece.path)]);
      }
      const tolerance = 1e-3;
      for (const [key, region] of oracle) {
        if (area(region) < tolerance) continue;
        const mine = got.get(key) ?? [];
        expect(area(mine), key).toBeCloseTo(area(region), 2);
        const diff = polygonClipping.xor(mine, region);
        expect(area(diff), key).toBeLessThan(tolerance);
      }
      for (const [key, region] of got) {
        if (!oracle.has(key)) expect(area(region), key).toBeLessThan(tolerance);
      }
    });
  }

  it('cuts one face per connected part, not per subset', () => {
    // Two bars crossing a box leave it in three parts and each bar in two.
    const box: Path = { kind: 'rect', x: 0, y: 0, width: 50, height: 10 };
    const bar1: Path = { kind: 'rect', x: 10, y: -5, width: 5, height: 20 };
    const bar2: Path = { kind: 'rect', x: 30, y: -5, width: 5, height: 20 };
    const pieces = pathFacePieces(box, bar1, bar2);
    expect(pieces.map((p) => p.sources)).toEqual([[0], [0], [0], [1], [1], [2], [2], [0, 1], [0, 2]]);
  });

  it('nests a shape wholly inside another as a hole, and inside that hole another', () => {
    const outer: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    const middle: Path = { kind: 'rect', x: 20, y: 20, width: 60, height: 60 };
    const inner: Path = { kind: 'rect', x: 40, y: 40, width: 20, height: 20 };
    const pieces = pathFacePieces(outer, middle, inner);
    expect(pieces.map((p) => p.sources)).toEqual([[0], [0, 1], [0, 1, 2]]);
    const areas = pieces.map((p) => area(pathToMultiPolygon(p.path)));
    expect(areas[0]).toBeCloseTo(100 * 100 - 60 * 60);
    expect(areas[1]).toBeCloseTo(60 * 60 - 20 * 20);
    expect(areas[2]).toBeCloseTo(20 * 20);
  });

  it('shares edges that lie along each other', () => {
    const a: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const b: Path = { kind: 'rect', x: 10, y: 0, width: 10, height: 10 };
    const c: Path = { kind: 'rect', x: 5, y: 0, width: 10, height: 5 };
    const pieces = pathFacePieces(a, b, c);
    const total = pieces.reduce((s, p) => s + area(pathToMultiPolygon(p.path)), 0);
    expect(total).toBeCloseTo(200);
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [0, 2], [1, 2]]);
  });

  it('answers nothing for no inputs or only empty ones', () => {
    expect(pathFacePieces()).toEqual([]);
    expect(pathFacePieces(polygonPath([]))).toEqual([]);
  });
});
