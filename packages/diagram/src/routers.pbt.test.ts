/**
 * The routers on any two ports and any waypoints: each starts on `from` and ends on `to` exactly, passes every
 * waypoint as a point of its own, stays finite, and moves with a translation of its input. `orthogonal` runs along
 * the axes, leaving along its first port's axis and arriving along its last's wherever a leg turns.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import { anyCoord, coord, gridCoord, nonFinite, point, port, runs, samePointsWithin, tally, timeoutFor, translate } from './pbt.fixture';
import { avoid, bezier, orthogonal, straight, type RouteRequest, type Router } from './routers';
import type { Port } from './types';

const RUNS = 300;

const request = (c: fc.Arbitrary<number> = coord): fc.Arbitrary<RouteRequest> =>
  fc.record({ from: port(c), to: port(c), waypoints: fc.array(point(c), { maxLength: 4 }) });

const ROUTERS: [string, Router][] = [['straight', straight], ['orthogonal', orthogonal], ['bezier', bezier], ['avoid', avoid]];

/** Whether `points` holds each of `stops` in order. */
function visits(points: readonly Vec2[], stops: readonly Vec2[]): boolean {
  let k = 0;
  for (const p of points) if (k < stops.length && p.x === stops[k]!.x && p.y === stops[k]!.y) k++;
  return k === stops.length;
}

const moved = (p: Port, dx: number, dy: number): Port => ({ ...p, point: translate(p.point, dx, dy) });

const horizontal = (n: Vec2 | null) => Math.abs(n?.x ?? 1) >= Math.abs(n?.y ?? 0);

describe.each(ROUTERS)('%s', (_name, router) => {
  it('runs from `from` to `to` through every waypoint, finite', () => {
    fc.assert(fc.property(request(), (req) => {
      const out = router(req);
      const same = (p: Vec2 | undefined, q: Vec2) => p !== undefined && p.x === q.x && p.y === q.y;
      expect(same(out[0], req.from.point)).toBe(true);
      expect(same(out[out.length - 1], req.to.point)).toBe(true);
      expect(visits(out, [req.from.point, ...req.waypoints, req.to.point])).toBe(true);
      expect(nonFinite(out)).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('stays finite from ports and waypoints anywhere in the double range', () => {
    fc.assert(fc.property(request(anyCoord), (req) => {
      expect(nonFinite(router(req))).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('moves with its input', () => {
    const dist = fc.integer({ min: -100, max: 100 }).map((n) => n * 10);
    fc.assert(fc.property(request(gridCoord), dist, dist, (req, dx, dy) => {
      const shifted = router({ from: moved(req.from, dx, dy), to: moved(req.to, dx, dy), waypoints: req.waypoints.map((w) => translate(w, dx, dy)) });
      expect(samePointsWithin(shifted, router(req).map((p) => translate(p, dx, dy)), 1e-9)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

describe('orthogonal', () => {
  it('runs along the axes, leaving and arriving along its ports\' axes wherever a leg turns', () => {
    const seen = tally();
    fc.assert(fc.property(request(), (req) => {
      const out = orthogonal(req);
      const segs = out.slice(1).map((p, i) => ({ a: out[i]!, b: p })).filter((s) => s.a.x !== s.b.x || s.a.y !== s.b.y);
      for (const { a, b } of segs) expect(a.x === b.x || a.y === b.y).toBe(true);
      const stops = [req.from.point, ...req.waypoints, req.to.point];
      const bent = (a: Vec2, b: Vec2) => a.x !== b.x && a.y !== b.y;
      if (stops.length >= 2 && bent(stops[0]!, stops[1]!)) {
        seen.count('leaves');
        expect(segs[0]!.a.y === segs[0]!.b.y).toBe(horizontal(req.from.normal));
      }
      const last = segs[segs.length - 1];
      // The last leg starts wherever the route stood when it reached the last waypoint.
      if (last !== undefined && req.to.normal !== null && bent(stops[stops.length - 2]!, req.to.point)) {
        seen.count('arrives');
        expect(last.a.y === last.b.y).toBe(horizontal(req.to.normal));
      }
    }), runs(RUNS));
    seen.atLeast('leaves', RUNS / 4);
    seen.atLeast('arrives', RUNS / 4);
  }, timeoutFor(RUNS, 2));
});
