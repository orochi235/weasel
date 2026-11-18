/**
 * Properties of the geometry a mark is stored in: fractions of a content box and back, a shape restated against its
 * own bounds so it follows them when they move, the bounds of a set of points, containment, the fitted camera of a
 * target with none of its own, and whether a mark has gone stale under its target's config.
 */
import { deepEqual } from '@weasel-js/registry';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { worldToScreen } from '../canvas/canvasCoords';
import { configValueAt, hasConfigPath, withConfigValueAt } from '../config/path';
import { configTree, leafValue, path, runs, tally, timeoutFor } from '../pbt.fixture';
import {
  boundsOf,
  fracContains,
  fracEncloses,
  fracToWorld,
  fromShape,
  roundFrac,
  toShape,
  worldToFrac,
} from './frac';
import { isStale, seenValues } from './staleness';
import type { FracPoint, FracRect } from './types';
import { fitView } from './view';

const RUNS = 200;

const coord = fc.double({ min: -4, max: 4, noNaN: true, noDefaultInfinity: true });
const size = fc.oneof(
  fc.constant(0),
  fc.double({ min: 0, max: 4, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: 1e-3, max: 4, noNaN: true, noDefaultInfinity: true }),
);
const side = fc.oneof(
  { arbitrary: fc.constant(0), weight: 1 },
  {
    arbitrary: fc.double({ min: 1e-3, max: 4096, noNaN: true, noDefaultInfinity: true }),
    weight: 5,
  },
);
const point: fc.Arbitrary<FracPoint> = fc.record({ x: coord, y: coord });
const rect: fc.Arbitrary<FracRect> = fc.record({ x: coord, y: coord, width: size, height: size });
const content = fc.record({ width: side, height: side });

const near = (a: number, b: number, scale = 1) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), scale);

describe('fractions of a content box', () => {
  it(
    'go to world units and back unchanged, and a side with no length reads 0, never NaN',
    () => {
      const t = tally();
      fc.assert(
        fc.property(rect, content, (f, c) => {
          const back = worldToFrac(fracToWorld(f, c), c);
          for (const v of Object.values(back)) expect(Number.isFinite(v)).toBe(true);
          if (c.width > 0) {
            t.count('width');
            expect(near(back.x, f.x) && near(back.width, f.width)).toBe(true);
          } else expect(back.x === 0 && back.width === 0).toBe(true);
          if (c.height > 0) expect(near(back.y, f.y) && near(back.height, f.height)).toBe(true);
          else {
            t.count('no height');
            expect(back.y === 0 && back.height === 0).toBe(true);
          }
        }),
        runs(RUNS),
      );
      t.atLeast('width', RUNS / 4);
      t.atLeast('no height', RUNS / 20);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'round to the nearest 4 decimal places, once',
    () => {
      fc.assert(
        fc.property(rect, (f) => {
          const r = roundFrac(f);
          expect(roundFrac(r)).toEqual(r);
          for (const k of ['x', 'y', 'width', 'height'] as const)
            expect(Math.abs(r[k] - f[k])).toBeLessThanOrEqual(0.5e-4 + 1e-12);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe("a mark's shape", () => {
  it(
    'follows its bounds: a shape taken in one box and placed in another lands where the affine map between them puts it',
    () => {
      const t = tally();
      fc.assert(
        fc.property(fc.array(point, { maxLength: 6 }), rect, rect, (pts, from, to) => {
          const moved = fromShape(toShape(pts, from), to);
          expect(moved).toHaveLength(pts.length);
          pts.forEach((p, i) => {
            const m = moved[i] as FracPoint;
            expect(Number.isFinite(m.x) && Number.isFinite(m.y)).toBe(true);
            const fx = from.width === 0 ? 0 : (p.x - from.x) / from.width;
            const fy = from.height === 0 ? 0 : (p.y - from.y) / from.height;
            if (!Number.isFinite(fx) || !Number.isFinite(fy)) return;
            t.count('moved');
            expect(near(m.x, to.x + fx * to.width, Math.abs(fx) * to.width)).toBe(true);
            expect(near(m.y, to.y + fy * to.height, Math.abs(fy) * to.height)).toBe(true);
          });
          if (pts.length > 0 && from.width > 1e-3 && from.height > 1e-3) {
            t.count('round trip');
            fromShape(toShape(pts, from), from).forEach((m, i) => {
              const p = pts[i] as FracPoint;
              expect(Math.abs(m.x - p.x)).toBeLessThan(
                1e-9 * Math.max(1, Math.abs(p.x) / from.width),
              );
              expect(Math.abs(m.y - p.y)).toBeLessThan(
                1e-9 * Math.max(1, Math.abs(p.y) / from.height),
              );
            });
          }
        }),
        runs(RUNS),
      );
      t.atLeast('round trip', RUNS / 40);
      t.atLeast('moved', RUNS);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    "has bounds that hold every point, touch each extreme, and contain the shape's own corners",
    () => {
      fc.assert(
        fc.property(fc.array(point, { maxLength: 6 }), (pts) => {
          const b = boundsOf(pts);
          if (pts.length === 0) {
            expect(b).toBeNull();
            return;
          }
          if (!b) throw new Error('no bounds for points');
          // `x + width` can round a hair off the largest x it was taken from, so the far edges are checked to an ulp.
          const ulp = (n: number) => 4 * Number.EPSILON * Math.abs(n) + Number.MIN_VALUE;
          const maxX = Math.max(...pts.map((p) => p.x));
          const maxY = Math.max(...pts.map((p) => p.y));
          expect(Math.min(...pts.map((p) => p.x))).toBe(b.x);
          expect(Math.min(...pts.map((p) => p.y))).toBe(b.y);
          expect(Math.abs(b.x + b.width - maxX)).toBeLessThanOrEqual(ulp(maxX) + ulp(b.x));
          expect(Math.abs(b.y + b.height - maxY)).toBeLessThanOrEqual(ulp(maxY) + ulp(b.y));
          for (const p of pts)
            expect(fracContains(b, p, ulp(maxX) + ulp(maxY) + ulp(b.x) + ulp(b.y))).toBe(true);
          for (const s of toShape(pts, b)) {
            expect(s.x).toBeGreaterThanOrEqual(0);
            expect(s.x).toBeLessThanOrEqual(1 + 1e-12);
            expect(s.y).toBeGreaterThanOrEqual(0);
            expect(s.y).toBeLessThanOrEqual(1 + 1e-12);
          }
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe('containment', () => {
  it(
    'a box encloses another exactly when it contains all four of its corners',
    () => {
      const t = tally();
      // A quarter grid, so edges coincide often.
      const q = fc.integer({ min: -4, max: 4 }).map((n) => n / 4);
      const qs = fc.integer({ min: 0, max: 8 }).map((n) => n / 4);
      const qRect = fc.record({ x: q, y: q, width: qs, height: qs });
      fc.assert(
        fc.property(qRect, qRect, (outer, inner) => {
          const corners = [
            { x: inner.x, y: inner.y },
            { x: inner.x + inner.width, y: inner.y },
            { x: inner.x, y: inner.y + inner.height },
            { x: inner.x + inner.width, y: inner.y + inner.height },
          ];
          const encloses = fracEncloses(outer, inner);
          t.count(encloses ? 'encloses' : 'does not');
          expect(encloses).toBe(corners.every((c) => fracContains(outer, c)));
        }),
        runs(RUNS),
      );
      t.atLeast('encloses', RUNS / 40);
      t.atLeast('does not', RUNS / 4);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'a tolerance widens a box on every side by exactly that much',
    () => {
      fc.assert(
        fc.property(rect, point, fc.double({ min: 0, max: 1, noNaN: true }), (box, p, tol) => {
          const widened = {
            x: box.x - tol,
            y: box.y - tol,
            width: box.width + 2 * tol,
            height: box.height + 2 * tol,
          };
          const inside =
            p.x >= widened.x &&
            p.x <= box.x + box.width + tol &&
            p.y >= widened.y &&
            p.y <= box.y + box.height + tol;
          expect(fracContains(box, p, tol)).toBe(inside);
          if (fracContains(box, p)) expect(fracContains(box, p, tol)).toBe(true);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe('the fitted camera', () => {
  const window = fc.record({ x: coord, y: coord, width: side, height: side });
  it(
    'shows the window it is given inside the pane, filling it along one axis, and stays finite on an unmeasured pane',
    () => {
      const t = tally();
      fc.assert(
        fc.property(content, content, fc.option(window, { nil: undefined }), (c, pane, shown) => {
          const view = fitView(c, pane, shown);
          expect(Number.isFinite(view.zoom) && view.zoom > 0).toBe(true);
          expect(Number.isFinite(view.pan.x) && Number.isFinite(view.pan.y)).toBe(true);
          const part = shown ?? { x: 0, y: 0, width: c.width, height: c.height };
          if (!(part.width > 0 && part.height > 0 && pane.width > 0 && pane.height > 0)) return;
          t.count('fits');
          const lo = worldToScreen({ x: part.x, y: part.y }, view);
          const hi = worldToScreen({ x: part.x + part.width, y: part.y + part.height }, view);
          const slack =
            1e-9 *
            Math.max(
              1,
              pane.width,
              pane.height,
              Math.abs(part.x * view.zoom),
              Math.abs(part.y * view.zoom),
            );
          expect(Math.abs(lo.x)).toBeLessThanOrEqual(slack);
          expect(Math.abs(lo.y)).toBeLessThanOrEqual(slack);
          expect(hi.x).toBeLessThanOrEqual(pane.width + slack);
          expect(hi.y).toBeLessThanOrEqual(pane.height + slack);
          const fillsX = near(hi.x - lo.x, pane.width, pane.width);
          const fillsY = near(hi.y - lo.y, pane.height, pane.height);
          expect(fillsX || fillsY).toBe(true);
        }),
        runs(RUNS),
      );
      t.atLeast('fits', RUNS / 4);
    },
    timeoutFor(RUNS, 1),
  );
});

/** Every path `tree` holds, leaves and records alike. */
function pathsIn(tree: unknown, at = ''): string[] {
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) return [];
  return Object.keys(tree).flatMap((k) => {
    const p = at === '' ? k : `${at}.${k}`;
    return [p, ...pathsIn((tree as Record<string, unknown>)[k], p)];
  });
}

/** Dependencies, some of them paths `tree` holds, and edits, some of them to those dependencies. */
function depsAndEdits(tree: unknown) {
  const held = pathsIn(tree);
  const dep = held.length > 0 ? fc.oneof(path, fc.constantFrom(...held)) : path;
  return fc
    .uniqueArray(dep, { maxLength: 4 })
    .chain((deps) =>
      fc.tuple(
        fc.constant(deps),
        fc.array(
          fc.tuple(deps.length > 0 ? fc.oneof(path, fc.constantFrom(...deps)) : path, leafValue),
          { minLength: 1, maxLength: 3 },
        ),
      ),
    );
}

describe('staleness', () => {
  const keys = fc.uniqueArray(path, { maxLength: 4 });
  it(
    'a mark is stale exactly when a dependency it saw now reads differently, and never against the config it was made under',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          configTree.chain((tree) => fc.tuple(fc.constant(tree), depsAndEdits(tree))),
          ([before, [deps, edits]]) => {
            const seen = seenValues(before, deps);
            expect(isStale(seen, before, deps)).toBe(false);
            for (const k of Object.keys(seen)) expect(deps).toContain(k);
            let after: unknown = before;
            for (const [p, v] of edits) after = withConfigValueAt(after, p, v);
            const moved = deps.some(
              (k) =>
                hasConfigPath(before, k) &&
                !deepEqual(configValueAt(before, k), configValueAt(after, k)),
            );
            const objectNow = after !== null && typeof after === 'object';
            t.count(moved && objectNow ? 'stale' : 'fresh');
            expect(isStale(seen, after, deps)).toBe(moved && objectNow);
          },
        ),
        runs(RUNS),
      );
      t.atLeast('stale', RUNS / 20);
      t.atLeast('fresh', RUNS / 10);
    },
    timeoutFor(RUNS, 2),
  );

  it(
    'a dependency a target declares after the mark was made never makes it stale',
    () => {
      fc.assert(
        fc.property(configTree, keys, path, leafValue, (config, deps, added, value) => {
          const seen = seenValues(
            config,
            deps.filter((k) => k !== added),
          );
          expect(isStale(seen, withConfigValueAt(config, added, value), [...deps, added])).toBe(
            isStale(
              seen,
              withConfigValueAt(config, added, value),
              deps.filter((k) => k !== added),
            ),
          );
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});
