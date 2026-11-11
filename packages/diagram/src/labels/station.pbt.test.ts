/**
 * `labelCenter` and its inverse `labelSpotAt` on any polyline route: a label is finite wherever it stands, one with no
 * offset sits on the route at its fraction of the length, and the spot read back from any center stands the label
 * where reading it again changes nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { polylineFromPoints, type Vec2 } from '@weasel-js/core/math';
import { measurePath } from '@weasel-js/geom';
import type { DiagramLabel } from '../labelTrait';
import { coord, gridCoord, nonFinite, point, runs, tally, timeoutFor } from '../pbt.fixture';
import { labelCenter, labelSpotAt } from './station';

const RUNS = 300;

/** A route: an orthogonal walk on the grid mostly, else any points. */
const route: fc.Arbitrary<Vec2[]> = fc.oneof(
  { weight: 2, arbitrary: fc.tuple(point(gridCoord), fc.array(fc.tuple(fc.boolean(), fc.integer({ min: -8, max: 8 })), { minLength: 1, maxLength: 6 }))
    .map(([start, steps]) => steps.reduce<Vec2[]>((out, [horizontal, n]) => {
      const last = out[out.length - 1]!;
      return [...out, horizontal ? { x: last.x + n * 10, y: last.y } : { x: last.x, y: last.y + n * 10 }];
    }, [start])) },
  { weight: 1, arbitrary: fc.array(point(coord), { minLength: 2, maxLength: 6 }) },
);

const size = fc.record({ width: fc.integer({ min: 0, max: 80 }), height: fc.integer({ min: 0, max: 30 }) });

const placement: fc.Arbitrary<DiagramLabel> = fc.record({
  at: fc.oneof(
    fc.constantFrom<'start' | 'mid' | 'end'>('start', 'mid', 'end'),
    fc.double({ min: -0.5, max: 1.5, noNaN: true }),
    point(coord).map((near) => ({ near })),
  ),
  offset: fc.option(fc.double({ min: -100, max: 100, noNaN: true }), { nil: undefined }),
  inset: fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }),
  placed: fc.option(fc.record({ at: fc.double({ min: 0, max: 1, noNaN: true }), offset: fc.double({ min: -100, max: 100, noNaN: true }) }), { nil: undefined }),
}).map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined)) as unknown as DiagramLabel);

const close = (a: Vec2, b: Vec2, eps: number) => Math.hypot(a.x - b.x, a.y - b.y) <= eps * Math.max(1, Math.hypot(a.x, a.y));

describe('labelCenter', () => {
  it('stands a label at a finite point on any route', () => {
    fc.assert(fc.property(route, placement, size, (points, label, sz) => {
      const c = labelCenter(polylineFromPoints(points), label, sz);
      expect(c).not.toBeNull();
      expect(nonFinite(c)).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('puts a label with no offset on the route, at its fraction of the length', () => {
    const seen = tally();
    fc.assert(fc.property(route, fc.double({ min: 0, max: 1, noNaN: true }), size, (points, at, sz) => {
      const path = polylineFromPoints(points);
      const c = labelCenter(path, { at }, sz)!;
      const m = measurePath(path)!;
      const near = m.nearest(c);
      expect(near.dist).toBeLessThanOrEqual(1e-6 * Math.max(1, m.length));
      const there = m.at(at * m.length).point;
      expect(close(c, there, 1e-9)).toBe(true);
      if (m.length > 0) seen.count('long');
    }), runs(RUNS));
    seen.atLeast('long', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});

describe('labelSpotAt', () => {
  it('reads back a spot that stands the label where reading it again changes nothing, nearest its station', () => {
    const seen = tally();
    fc.assert(fc.property(route, point(coord), size, (points, c, sz) => {
      const path = polylineFromPoints(points);
      const spot = labelSpotAt(path, c, sz)!;
      expect(nonFinite(spot)).toEqual([]);
      expect(spot.at).toBeGreaterThanOrEqual(0);
      expect(spot.at).toBeLessThanOrEqual(1);
      const stood = labelCenter(path, { at: spot.at, offset: spot.offset }, sz)!;
      // A label reads at the station nearest it; one standing far beside a short route can be nearer another.
      const m = measurePath(path)!;
      const station = m.at(spot.at * m.length).point;
      const reach = Math.hypot(stood.x - station.x, stood.y - station.y);
      if (reach > m.nearest(stood).dist + 1e-9 * Math.max(1, reach)) return;
      const again = labelSpotAt(path, stood, sz)!;
      const back = labelCenter(path, { at: again.at, offset: again.offset }, sz)!;
      if (spot.offset !== 0) seen.count('beside');
      expect(close(back, stood, 1e-6), `${JSON.stringify({ spot, stood, again, back })}`).toBe(true);
    }), runs(RUNS));
    seen.atLeast('beside', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});
