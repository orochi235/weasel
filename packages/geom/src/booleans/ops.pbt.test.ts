import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathExclude, pathIntersect, pathSubtract, pathUnion } from './ops';
import { pointInPath, strokeHitTest } from '../pathHitTest';
import { PathBuilder } from '../paths/builder';
import type { Path } from '../path';
import { coord, runs, timeoutFor } from '../pbt.fixtures';

const RUNS = runs(60);
const TIMEOUT = timeoutFor(60, 3);

/** A star-shaped polygon: simple, convex or not. */
const star = fc.record({
  cx: coord(40), cy: coord(40),
  radii: fc.array(fc.double({ min: 5, max: 60, noNaN: true }), { minLength: 3, maxLength: 9 }),
  turn: fc.double({ min: 0, max: Math.PI, noNaN: true }),
}).map(({ cx, cy, radii, turn }) => {
  const b = new PathBuilder();
  radii.forEach((r, i) => {
    const a = turn + (i / radii.length) * 2 * Math.PI;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  });
  return b.close().build() as Path;
});

/** A circle of four cubics. */
const circle = fc.record({ cx: coord(40), cy: coord(40), r: fc.double({ min: 5, max: 60, noNaN: true }) }).map(({ cx, cy, r }) => {
  const k = 0.5522847498 * r;
  return new PathBuilder().moveTo(cx + r, cy)
    .curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    .curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    .curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    .close().build() as Path;
});

const rect = fc.record({ x: coord(60), y: coord(60), width: fc.double({ min: 5, max: 100, noNaN: true }), height: fc.double({ min: 5, max: 100, noNaN: true }) })
  .map((r) => ({ kind: 'rect' as const, ...r }));

const shape = fc.oneof(star, circle, rect);
const probes = fc.array(fc.tuple(coord(110), coord(110)), { minLength: 20, maxLength: 20 });

/** Each probe clear of every outline, where flattening and float32 coords cannot move it across one. */
function clear(paths: readonly Path[], pts: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  return pts.filter(([x, y]) => paths.every((p) => !strokeHitTest(p, x, y, 0.75, { tolerance: 0.05 })));
}

describe('path booleans, near-coincident vertices (shrunk counterexample)', () => {
  // A float32 vertex 4e-16 from a rect's double corner left polygon-clipping unable to close a ring, and it threw.
  const star: Path = {
    kind: 'polygon', commands: Uint8Array.from([0, 1, 1, 1, 4]), fillRule: 'nonzero',
    coords: Float32Array.from([5, 0, 4.1558276599647237e-16, 6.78698205947876, -27.109140396118164, 3.3199121789618136e-15, -9.184850467946473e-16, -5]),
  };
  const box: Path = { kind: 'rect', x: 0, y: 0, width: 5, height: 6.7869820594787615 };

  it('intersects and unites without throwing, either way round', () => {
    for (const out of [pathIntersect(star, box), pathIntersect(box, star), pathUnion(star, box), pathUnion(box, star)]) {
      expect(out.commands.length).toBeGreaterThan(0);
    }
    expect(pointInPath(pathIntersect(star, box), 1, 1)).toBe(true);
    expect(pointInPath(pathUnion(star, box), -10, 0.5)).toBe(true);
    expect(pointInPath(pathIntersect(star, box), 4.5, 6)).toBe(false);
  });
});

describe('path booleans, property', () => {
  it('agree, point by point, with the logic they are named for', () => {
    const tally = { checked: 0, both: 0 };
    fc.assert(fc.property(shape, shape, probes, (a, b, pts) => {
      const results = {
        union: pathUnion(a, b), intersect: pathIntersect(a, b), subtract: pathSubtract(a, b), exclude: pathExclude(a, b),
      };
      for (const [x, y] of clear([a, b, ...Object.values(results)], pts)) {
        const inA = pointInPath(a, x, y), inB = pointInPath(b, x, y); tally.checked++; if (inA && inB) tally.both++;
        expect({ x, y, op: 'union', in: pointInPath(results.union, x, y) }).toEqual({ x, y, op: 'union', in: inA || inB });
        expect({ x, y, op: 'intersect', in: pointInPath(results.intersect, x, y) }).toEqual({ x, y, op: 'intersect', in: inA && inB });
        expect({ x, y, op: 'subtract', in: pointInPath(results.subtract, x, y) }).toEqual({ x, y, op: 'subtract', in: inA && !inB });
        expect({ x, y, op: 'exclude', in: pointInPath(results.exclude, x, y) }).toEqual({ x, y, op: 'exclude', in: inA !== inB });
      }
    }), RUNS);
    // Guards the filter above: a property whose probes all fall near an outline checks nothing.
    expect(tally.checked).toBeGreaterThan(RUNS.numRuns * 5);
    expect(tally.both).toBeGreaterThan(0);
  }, TIMEOUT);

  it('union and intersection do not care about the order of their inputs', () => {
    fc.assert(fc.property(shape, shape, probes, (a, b, pts) => {
      const ab = pathIntersect(a, b), ba = pathIntersect(b, a);
      const uab = pathUnion(a, b), uba = pathUnion(b, a);
      for (const [x, y] of clear([a, b, ab, ba, uab, uba], pts)) {
        expect(pointInPath(ba, x, y)).toBe(pointInPath(ab, x, y));
        expect(pointInPath(uba, x, y)).toBe(pointInPath(uab, x, y));
      }
    }), RUNS);
  }, TIMEOUT);
});
