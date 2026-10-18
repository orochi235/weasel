import { describe, expect, it } from 'vitest';
import { PathBuilder } from '../paths/builder';
import { pathToAnchors } from '../paths/anchors';
import type { Point } from '../paths/cubicMath';
import { createArapSolver } from './arap';
import { meshLocator, placeSpot } from './meshMap';
import { puppetMesh } from './puppetMesh';
import { puppetMap, type PuppetPin } from './puppet';
import { warpPath } from './warpPath';

/** A bar 200 long and 40 tall, held at its left end and bent down at its right. */
const bar = () => new PathBuilder().moveTo(0, 0).lineTo(200, 0).lineTo(200, 40).lineTo(0, 40).close().build();
const bend: PuppetPin[] = [
  { from: { x: 10, y: 10 }, to: { x: 10, y: 10 } },
  { from: { x: 10, y: 30 }, to: { x: 10, y: 30 } },
  { from: { x: 190, y: 20 }, to: { x: 170, y: 100 } },
];

/** The map a puppet made before it was smoothed: each point carried by the deformed triangle holding it. */
function piecewiseAffine(pins: readonly PuppetPin[]): (p: Point) => Point {
  const mesh = puppetMesh(bar(), pins.map((p) => p.from));
  const pinned = Array.from(mesh.pinVertex);
  const at = createArapSolver(mesh, pinned).solve(pins.flatMap((p) => [p.to.x, p.to.y]));
  const locate = meshLocator(mesh);
  return (p) => placeSpot(mesh.triangles, at, locate(p.x, p.y)!);
}

/** The sharpest turn, in degrees, between neighboring chords a thousandth of an edge long on the bar's warped
 *  outline: the resolution `warpPath` reads tangents at. */
function sharpestTurn(map: (p: Point) => Point): number {
  const ring = pathToAnchors(bar()).anchors[0];
  const steps = 1000;
  let worst = 0;
  ring.forEach((a, edge) => {
    const b = ring[(edge + 1) % ring.length];
    const heading = (i: number) => {
      const p = map({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
      const q = map({ x: a.x + ((b.x - a.x) * (i + 1)) / steps, y: a.y + ((b.y - a.y) * (i + 1)) / steps });
      return Math.atan2(q.y - p.y, q.x - p.x);
    };
    let last = heading(0);
    for (let i = 1; i < steps; i++) {
      const next = heading(i);
      worst = Math.max(worst, (Math.abs(Math.atan2(Math.sin(next - last), Math.cos(next - last))) * 180) / Math.PI);
      last = next;
    }
  });
  return worst;
}

/** The map's derivative at `p`, by central differences. */
function jacobian(map: (p: Point) => Point, p: Point, d: number): number[] {
  const xp = map({ x: p.x + d, y: p.y }), xm = map({ x: p.x - d, y: p.y });
  const yp = map({ x: p.x, y: p.y + d }), ym = map({ x: p.x, y: p.y - d });
  return [(xp.x - xm.x) / (2 * d), (yp.x - ym.x) / (2 * d), (xp.y - xm.y) / (2 * d), (yp.y - ym.y) / (2 * d)];
}

/** The largest jump in the map's derivative across any edge two triangles of the bar's mesh share. */
function worstKink(map: (p: Point) => Point): number {
  const mesh = puppetMesh(bar(), bend.map((p) => p.from));
  const V = mesh.vertices, T = mesh.triangles;
  const uses = new Map<string, number>();
  for (let t = 0; t < T.length / 3; t++) {
    for (let e = 0; e < 3; e++) {
      const a = T[3 * t + e], b = T[3 * t + (e + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  let worst = 0;
  for (const [key, n] of uses) {
    if (n !== 2) continue;
    const [a, b] = key.split(',').map(Number);
    const mx = (V[2 * a] + V[2 * b]) / 2, my = (V[2 * a + 1] + V[2 * b + 1]) / 2;
    const ex = V[2 * b] - V[2 * a], ey = V[2 * b + 1] - V[2 * a + 1];
    const len = Math.hypot(ex, ey);
    const nx = -ey / len, ny = ex / len;
    const eps = 1e-5, d = 2e-6;
    const one = jacobian(map, { x: mx + eps * nx, y: my + eps * ny }, d);
    const other = jacobian(map, { x: mx - eps * nx, y: my - eps * ny }, d);
    worst = Math.max(worst, ...one.map((v, i) => Math.abs(v - other[i])));
  }
  return worst;
}

describe('puppetMap smoothness', () => {
  it('has no kink across a triangle edge', () => {
    expect(worstKink(piecewiseAffine(bend))).toBeGreaterThan(1e-2);
    expect(worstKink(puppetMap(bar(), bend))).toBeLessThan(1e-4);
  });

  it('bends a straight edge without corners', () => {
    expect(sharpestTurn(piecewiseAffine(bend))).toBeGreaterThan(1);
    expect(sharpestTurn(puppetMap(bar(), bend))).toBeLessThan(0.3);
  });

  it('sends every pin exactly where it was dragged', () => {
    const map = puppetMap(bar(), bend);
    for (const pin of bend) {
      const at = map(pin.from);
      expect(at.x).toBeCloseTo(pin.to.x, 9);
      expect(at.y).toBeCloseTo(pin.to.y, 9);
    }
  });

  it('is the identity while no pin has moved', () => {
    const map = puppetMap(bar(), bend.map((p) => ({ from: p.from, to: { ...p.from } })));
    for (const p of [{ x: 0, y: 0 }, { x: 37.25, y: 11.5 }, { x: 200, y: 40 }, { x: 250, y: -30 }]) expect(map(p)).toEqual(p);
    expect(warpPath(bar(), map)).toEqual(warpPath(bar(), (p) => ({ x: p.x, y: p.y })));
  });

  it('carries a point off the shape smoothly on from the outline', () => {
    const map = puppetMap(bar(), bend);
    const on = map({ x: 100, y: 40 });
    const off = map({ x: 100, y: 40 + 1e-6 });
    expect(Math.hypot(off.x - on.x, off.y - on.y)).toBeLessThan(1e-5);
    const below = jacobian(map, { x: 100, y: 40 - 1e-5 }, 2e-6), above = jacobian(map, { x: 100, y: 40 + 1e-5 }, 2e-6);
    below.forEach((v, i) => expect(Math.abs(v - above[i])).toBeLessThan(1e-3));
    const far = map({ x: 100, y: 400 });
    expect(Number.isFinite(far.x) && Number.isFinite(far.y)).toBe(true);
  });
});
