import { describe, expect, test } from 'vitest';
import type { Point } from '../paths/cubicMath';
import { arcShape } from './arc';
import { placeAlongRun, runPlaces, runStationAt } from './place';
import { trackRun } from './run';
import { lineShape } from './shape';

const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(q.y);
};
const C = { x: 0, y: 0 };

describe('runPlaces', () => {
  test('a run shorter than its room sits centered', () => expect(runPlaces([20, 20], 10, 100, 'center', 0).map((s) => s.center)).toEqual([35, 65]));
  test('align start and end push it to the reading start and end', () => {
    expect(runPlaces([20, 20], 10, 100, 'start', 0).map((s) => s.center)).toEqual([10, 40]);
    expect(runPlaces([20, 20], 10, 100, 'end', 0).map((s) => s.center)).toEqual([60, 90]);
  });
  test('a run longer than its room lays from the start less the offset, and marks what lies past the ends', () => {
    expect(runPlaces([40, 40, 40, 40], 0, 100, 'center', 50)).toEqual([
      { center: -30, clipped: 'past' }, { center: 10, clipped: 'part' }, { center: 50, clipped: 'none' }, { center: 90, clipped: 'part' },
    ]);
  });
  test('no items is no places', () => expect(runPlaces([], 4, 100, 'center', 0)).toEqual([]));
  test("'at' anchors the sequence whether or not it fits", () => {
    expect(runPlaces([40, 40], 0, 100, 'center', 0, 30)).toEqual([
      { center: 10, clipped: 'part' }, { center: 50, clipped: 'none' },
    ]);
    expect(runPlaces([40, 40], 0, 100, 'start', 0, 0).map((s) => s.center)).toEqual([20, 60]);
    expect(runPlaces([40, 40], 0, 100, 'end', 10, 100).map((s) => s.center)).toEqual([30, 70]);
  });
});

describe('runStationAt', () => {
  const run = trackRun(lineShape(C, { x: 100, y: 0 }));
  test('within the run it is the run’s own place, moved along its up by shift', () => {
    close(runStationAt(run, 25).point, { x: 25, y: 0 });
    close(runStationAt(run, 25, 5).point, { x: 25, y: -5 });
  });
  test('past either end it carries on straight', () => {
    close(runStationAt(run, -20).point, { x: -20, y: 0 });
    close(runStationAt(run, 130).point, { x: 130, y: 0 });
  });
});

describe('placeAlongRun', () => {
  const run = trackRun(lineShape(C, { x: 100, y: 0 }));
  test("on a line it puts each item's center on the line", () => {
    const places = placeAlongRun(run, [20, 20], { align: 'start', at: 0 });
    close(places[0]!.point, { x: 10, y: 0 });
    close(places[1]!.point, { x: 30, y: 0 });
    expect(places.map((p) => p.angle)).toEqual([0, 0]);
  });
  test('shift moves items off the run along its up', () => {
    for (const p of placeAlongRun(run, [20, 20], { shift: 5 })) expect(p.point.y).toBeCloseTo(-5);
  });
  test('an item past the end carries on straight', () => {
    const three = placeAlongRun(run, [40, 40, 40], { align: 'start', at: 0 });
    expect(three[2]!.center).toBe(100);
    expect(three[2]!.clipped).toBe('part');
    close(three[2]!.point, { x: 100, y: 0 });
    close(placeAlongRun(run, [60, 60], { align: 'start', at: 0 })[1]!.point, { x: 90, y: 0 });
    const beyond = placeAlongRun(run, [60, 60, 60], { align: 'start', at: 0 });
    expect(beyond[2]!.clipped).toBe('past');
    close(beyond[2]!.point, { x: 150, y: 0 });
  });
  test("past: 'hold' waits a past item at the nearer end", () => {
    const held = placeAlongRun(run, [60, 60, 60], { align: 'start', at: 0, past: 'hold' });
    close(held[2]!.point, { x: 100, y: 0 });
    close(held[1]!.point, { x: 90, y: 0 });
    close(placeAlongRun(run, [60, 60], { align: 'end', at: 0, past: 'hold' })[0]!.point, { x: 0, y: 0 });
  });
  test('on an arc the place tips to the tangent', () => {
    const top = trackRun(arcShape({ center: C, radius: 100, start: 270, end: 90 }));
    const [p] = placeAlongRun(top, [10], { at: top.length / 2 });
    close(p!.point, { x: 0, y: -100 });
    expect(p!.angle).toBeCloseTo(0);
  });
  describe('wrap carries items round a closed run', () => {
    const circle = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 0 }));
    const L = circle.length;
    test('an item past the seam lands where its distance comes round to', () => {
      const places = placeAlongRun(circle, [L / 4, L / 4], { align: 'start', at: 0.9 * L, wrap: true });
      close(places[1]!.point, circle.at(((0.9 * L + (3 * L) / 8) % L) / L).point);
      expect(places.map((p) => p.clipped)).toEqual(['none', 'none']);
    });
    test('an item a full lap on from the first is past', () => {
      const places = placeAlongRun(circle, [L / 2, L / 2, L / 2], { align: 'start', at: 0.9 * L, wrap: true });
      expect(places.map((p) => p.clipped)).toEqual(['none', 'none', 'past']);
      expect(placeAlongRun(circle, [L / 2, (3 * L) / 4], { align: 'start', at: 0, wrap: true })[1]!.clipped).toBe('part');
    });
  });
});
