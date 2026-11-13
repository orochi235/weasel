import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathExclude, pathIntersect, pathSubtract, pathUnion } from './ops';
import { pointInPath, strokeHitTest } from '../pathHitTest';
import type { Path } from '../path';
import { coord, runs, shape, timeoutFor } from '../pbt.fixture';

const RUNS = runs(60);
const TIMEOUT = timeoutFor(60, 3);

const probes = fc.array(fc.tuple(coord(110), coord(110)), { minLength: 20, maxLength: 20 });

/** Each probe clear of every outline, where flattening and float32 coords cannot move it across one. */
function clear(paths: readonly Path[], pts: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  return pts.filter(([x, y]) => paths.every((p) => !strokeHitTest(p, x, y, 0.75, { flattenTolerance: 0.05 })));
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
