import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathExclude, pathIntersect, pathSubtract, pathUnion } from './ops';
import { forEachSegment, pathCommandCoordCount, PATH_C, PATH_M, PATH_Q, PATH_Z } from '../commands';
import { DEFAULT_FLATTEN_TOLERANCE } from '../flatten';
import { pathSignedArea } from '../paths/winding';
import type { Path, PolygonPath } from '../path';
import { circleAt, coord, runs, shape, starAt, timeoutFor } from '../pbt.fixture';

const RUNS = runs(40);
const TIMEOUT = timeoutFor(40, 6);

const area = (p: Path): number => Math.abs(pathSignedArea(p));

/** Every command known, every coord finite, each subpath opened by an `M`, and the coords exactly what the commands read. */
function expectWellFormed(p: PolygonPath): void {
  let need = 0, open = false;
  p.commands.forEach((cmd, i) => {
    if (cmd === PATH_M) open = true;
    else expect({ i, cmd, open }).toEqual({ i, cmd, open: true });
    if (cmd === PATH_Z) open = false;
    need += pathCommandCoordCount(cmd);
  });
  expect(p.coords.length).toBe(need);
  expect(Array.from(p.coords).every(Number.isFinite)).toBe(true);
  expect(p.fillRule).toBe('nonzero');
}

/** The length of a path's control polygon, which bounds the outline's: zero for one with no curve. */
function curvedPerimeter(p: Path): number {
  if (p.kind === 'rect') return 0;
  let sum = 0, curved = false;
  forEachSegment(p.commands, p.coords, (cmd, ci, x, y) => {
    if (cmd === PATH_C || cmd === PATH_Q) curved = true;
    const n = pathCommandCoordCount(cmd);
    for (let k = 0; k < n; k += 2) {
      sum += Math.hypot(p.coords[ci + k]! - x, p.coords[ci + k + 1]! - y);
      x = p.coords[ci + k]!; y = p.coords[ci + k + 1]!;
    }
  });
  return curved ? sum : 0;
}

/** The area two results may disagree by: where `curveBoolean` declines, curves are flattened to
 *  `DEFAULT_FLATTEN_TOLERANCE`, a band that wide along each curved outline; straight outlines agree to rounding. */
function slack(a: Path, b: Path): number {
  return DEFAULT_FLATTEN_TOLERANCE * (curvedPerimeter(a) + curvedPerimeter(b)) + 1e-6 * (area(a) + area(b)) + 1e-9;
}

describe('path booleans, area laws (property)', () => {
  it('obey inclusion and exclusion, and every result is well formed', () => {
    const tally = { overlapping: 0 };
    fc.assert(fc.property(shape, shape, (a, b) => {
      const u = pathUnion(a, b), i = pathIntersect(a, b), s = pathSubtract(a, b), x = pathExclude(a, b);
      for (const r of [u, i, s, x]) expectWellFormed(r);
      const tol = slack(a, b);
      if (area(i) > tol) tally.overlapping++;
      expect(Math.abs(area(u) + area(i) - area(a) - area(b))).toBeLessThan(tol);
      expect(Math.abs(area(s) - (area(a) - area(i)))).toBeLessThan(tol);
      expect(Math.abs(area(x) - (area(u) - area(i)))).toBeLessThan(tol);
      expect(area(i)).toBeLessThan(Math.min(area(a), area(b)) + tol);
      expect(area(u)).toBeGreaterThan(Math.max(area(a), area(b)) - tol);
    }), RUNS);
    expect(tally.overlapping).toBeGreaterThan(RUNS.numRuns / 5);
  }, TIMEOUT);

  it('a shape with itself: union and intersection are the shape, subtraction and exclusion are empty', () => {
    fc.assert(fc.property(shape, (a) => {
      const tol = slack(a, a);
      expect(Math.abs(area(pathUnion(a, a)) - area(a))).toBeLessThan(tol);
      expect(Math.abs(area(pathIntersect(a, a)) - area(a))).toBeLessThan(tol);
      expect(area(pathSubtract(a, a))).toBeLessThan(tol);
      expect(area(pathExclude(a, a))).toBeLessThan(tol);
    }), RUNS);
  }, TIMEOUT);

  it('commute in area, the subtraction excepted, which takes what the other order leaves', () => {
    fc.assert(fc.property(shape, shape, (a, b) => {
      const tol = slack(a, b);
      expect(Math.abs(area(pathUnion(a, b)) - area(pathUnion(b, a)))).toBeLessThan(tol);
      expect(Math.abs(area(pathIntersect(a, b)) - area(pathIntersect(b, a)))).toBeLessThan(tol);
      expect(Math.abs(area(pathExclude(a, b)) - area(pathExclude(b, a)))).toBeLessThan(tol);
      const both = area(pathSubtract(a, b)) + area(pathSubtract(b, a));
      expect(Math.abs(both - area(pathExclude(a, b)))).toBeLessThan(tol);
    }), RUNS);
  }, TIMEOUT);
});

/** A rect on a coarse grid, in cells: edges shared, corners touching, one inside another, often. */
const cell = fc.record({
  x: fc.integer({ min: 0, max: 4 }), y: fc.integer({ min: 0, max: 4 }),
  w: fc.integer({ min: 1, max: 4 }), h: fc.integer({ min: 1, max: 4 }),
});
type Cells = { x: number; y: number; w: number; h: number };
const covers = (r: Cells, i: number, j: number): boolean => i >= r.x && i < r.x + r.w && j >= r.y && j < r.y + r.h;

describe('path booleans, degenerate contact (property)', () => {
  it('rects sharing edges and corners combine to the cells each logic names', () => {
    const tally = { touching: 0 };
    fc.assert(fc.property(cell, cell, fc.constantFrom(1, 0.1, 7.5), (ca, cb, unit) => {
      const toPath = (r: Cells): Path => ({ kind: 'rect', x: r.x * unit, y: r.y * unit, width: r.w * unit, height: r.h * unit });
      const a = toPath(ca), b = toPath(cb);
      const count = (keep: (inA: boolean, inB: boolean) => boolean): number => {
        let n = 0;
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (keep(covers(ca, i, j), covers(cb, i, j))) n++;
        return n * unit * unit;
      };
      const apart = count((p, q) => p && q) === 0;
      const touch = ca.x <= cb.x + cb.w && cb.x <= ca.x + ca.w && ca.y <= cb.y + cb.h && cb.y <= ca.y + ca.h;
      if (apart && touch) tally.touching++;
      const tol = 1e-6 * (area(a) + area(b));
      const ops = { union: pathUnion(a, b), intersect: pathIntersect(a, b), subtract: pathSubtract(a, b), exclude: pathExclude(a, b) };
      for (const r of Object.values(ops)) expectWellFormed(r);
      expect(Math.abs(area(ops.union) - count((p, q) => p || q))).toBeLessThan(tol);
      expect(Math.abs(area(ops.intersect) - count((p, q) => p && q))).toBeLessThan(tol);
      expect(Math.abs(area(ops.subtract) - count((p, q) => p && !q))).toBeLessThan(tol);
      expect(Math.abs(area(ops.exclude) - count((p, q) => p !== q))).toBeLessThan(tol);
    }), RUNS);
    expect(tally.touching).toBeGreaterThan(RUNS.numRuns / 20);
  }, TIMEOUT);

  it('a contour drawn over itself, the other way round or from another start, combines as one', () => {
    const turned = fc.record({
      cx: coord(40), cy: coord(40), radii: fc.array(fc.double({ min: 5, max: 60, noNaN: true }), { minLength: 3, maxLength: 9 }),
      turn: fc.double({ min: 0, max: Math.PI, noNaN: true }), roll: fc.nat(), reverse: fc.boolean(),
    });
    fc.assert(fc.property(turned, ({ cx, cy, radii, turn, roll, reverse }) => {
      const a = starAt(cx, cy, radii, turn);
      const k = roll % radii.length;
      // The same vertices from vertex k, in either order: the same outline, coincident throughout.
      const order = radii.map((_, i) => (i + k) % radii.length);
      if (reverse) order.reverse();
      const pts = order.map((i) => {
        const t = turn + (i / radii.length) * 2 * Math.PI;
        return [cx + radii[i] * Math.cos(t), cy + radii[i] * Math.sin(t)] as const;
      });
      const b: Path = {
        kind: 'polygon', fillRule: 'nonzero',
        commands: Uint8Array.from([PATH_M, ...pts.slice(1).map(() => 1), PATH_Z]),
        coords: Float32Array.from(pts.flat()),
      };
      const tol = slack(a, a);
      expect(Math.abs(area(pathUnion(a, b)) - area(a))).toBeLessThan(tol);
      expect(Math.abs(area(pathIntersect(a, b)) - area(a))).toBeLessThan(tol);
      expect(area(pathSubtract(a, b))).toBeLessThan(tol);
      expect(area(pathExclude(a, b))).toBeLessThan(tol);
    }), RUNS);
  }, TIMEOUT);

  it('circles nearly tangent, inside or out, combine without a throw and by inclusion and exclusion', () => {
    const pair = fc.record({
      r1: fc.double({ min: 5, max: 60, noNaN: true }), r2: fc.double({ min: 5, max: 60, noNaN: true }),
      dir: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), inner: fc.boolean(),
      gap: fc.oneof(fc.constant(0), fc.double({ min: -1e-3, max: 1e-3, noNaN: true })),
    });
    fc.assert(fc.property(pair, ({ r1, r2, dir, inner, gap }) => {
      const d = (inner ? Math.abs(r1 - r2) : r1 + r2) + gap;
      fc.pre(d > 1e-3);
      const a = circleAt(0, 0, r1), b = circleAt(d * Math.cos(dir), d * Math.sin(dir), r2);
      const u = pathUnion(a, b), i = pathIntersect(a, b), s = pathSubtract(a, b), x = pathExclude(a, b);
      for (const r of [u, i, s, x]) expectWellFormed(r);
      const tol = slack(a, b);
      expect(Math.abs(area(u) + area(i) - area(a) - area(b))).toBeLessThan(tol);
      expect(Math.abs(area(s) - (area(a) - area(i)))).toBeLessThan(tol);
      expect(Math.abs(area(x) - (area(u) - area(i)))).toBeLessThan(tol);
    }), RUNS);
  }, TIMEOUT);
});
