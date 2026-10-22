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
  test("with 'follow', past an arc's end it carries on round the arc's circle, tipped to it there", () => {
    // The top quarter, 12 to 3 o'clock, radius 100: a quarter turn past its end is 6 o'clock.
    const arc = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 90 }), 0, 1, { side: 'path' });
    const quarter = (Math.PI / 2) * 100;
    close(runStationAt(arc, 2 * quarter, 0, 'follow').point, { x: 0, y: 100 });
    close(runStationAt(arc, -quarter, 0, 'follow').point, { x: -100, y: 0 });
    expect(runStationAt(arc, 2 * quarter, 0, 'follow').angle).toBeCloseTo(180);
    close(runStationAt(arc, 2 * quarter, 10, 'follow').point, { x: 0, y: 110 });
  });
});

describe("placeAlongRun with past: 'follow'", () => {
  test('lays an item past an arc run’s end on round its circle, not straight along the end', () => {
    const arc = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 90 }), 0, 1, { side: 'path' });
    const quarter = (Math.PI / 2) * 100;
    const places = placeAlongRun(arc, [quarter, quarter], { align: 'start', at: 0, past: 'follow' });
    expect(places[1]!.clipped).toBe('past');
    // Its center is an eighth turn past 3 o'clock.
    close(places[1]!.point, { x: 100 * Math.SQRT1_2, y: 100 * Math.SQRT1_2 });
  });
  test("past: 'hold' follows the shape with an item part past the end, then holds it once wholly past", () => {
    const arc = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 90 }), 0, 1, { side: 'path' });
    const quarter = (Math.PI / 2) * 100;
    const places = placeAlongRun(arc, [quarter / 2, quarter, quarter], { align: 'start', at: 0, offset: -quarter / 4, past: 'hold' });
    expect(places.map((p) => p.clipped)).toEqual(['none', 'part', 'past']);
    // Laid from a quarter of a quarter in, the middle item's center is a quarter of a quarter past 3 o'clock, round the circle.
    const turn = (90 + 0.25 * 90) * (Math.PI / 180);
    close(places[1]!.point, { x: 100 * Math.sin(turn), y: -100 * Math.cos(turn) });
    close(places[2]!.point, { x: 100, y: 0 });
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
  test('wrap is a no-op on an open run', () => {
    const opts = { align: 'start', at: 0, gap: 3 } as const;
    expect(placeAlongRun(run, [60, 60, 60], { ...opts, wrap: true })).toEqual(placeAlongRun(run, [60, 60, 60], opts));
  });
  test('a zero-length run gives finite places', () => {
    const dot = trackRun(lineShape(C, C));
    for (const p of placeAlongRun(dot, [10, 10], { gap: 2 })) {
      expect(Number.isFinite(p.point.x)).toBe(true);
      expect(Number.isFinite(p.point.y)).toBe(true);
    }
  });
  describe('wrap carries items round a closed run', () => {
    const circle = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 0 }));
    const L = circle.length;
    test('an item past the seam lands where its distance comes round to', () => {
      const places = placeAlongRun(circle, [L / 4, L / 4], { align: 'start', at: 0.9 * L, wrap: true });
      close(places[1]!.point, circle.at(((0.9 * L + (3 * L) / 8) % L) / L).point);
      expect(places.map((p) => p.clipped)).toEqual(['none', 'none']);
    });
    test("with past: 'hold', a past item on a closed run lands at the first item's start", () => {
      const held = placeAlongRun(circle, [L / 2, L / 2, L / 2], { align: 'start', at: 0.9 * L, wrap: true, past: 'hold' });
      close(held[2]!.point, circle.at(0.9).point);
    });
    test('an item a full lap on from the first is past', () => {
      const places = placeAlongRun(circle, [L / 2, L / 2, L / 2], { align: 'start', at: 0.9 * L, wrap: true });
      expect(places.map((p) => p.clipped)).toEqual(['none', 'none', 'past']);
      expect(placeAlongRun(circle, [L / 2, (3 * L) / 4], { align: 'start', at: 0, wrap: true })[1]!.clipped).toBe('part');
    });
  });
  describe("order: 'track' lays items from the shape's own start", () => {
    const back = trackRun(lineShape({ x: 100, y: 0 }, C));
    const opts = { align: 'start', at: 0 } as const;
    test("the default and 'reading' are the same, reading order", () => {
      const base = placeAlongRun(back, [10, 20], opts);
      expect(placeAlongRun(back, [10, 20], { ...opts, order: 'reading' })).toEqual(base);
      close(base[0]!.point, { x: 5, y: 0 });
      close(base[1]!.point, { x: 20, y: 0 });
    });
    test('on a reversed run item 0 sits at the shape start', () => {
      expect(back.reversed).toBe(true);
      const places = placeAlongRun(back, [10, 20], { ...opts, order: 'track' });
      close(places[0]!.point, { x: 95, y: 0 });
      close(places[1]!.point, { x: 80, y: 0 });
    });
    test('on a reversed curve each item stands as the run reads at its own place', () => {
      const bottom = trackRun(arcShape({ center: C, radius: 100, start: 90, end: 270 }));
      expect(bottom.reversed).toBe(true);
      const L = bottom.length;
      const places = placeAlongRun(bottom, [10, 20], { ...opts, order: 'track' });
      const at = [bottom.at(1 - 5 / L), bottom.at(1 - 20 / L)];
      places.forEach((p, i) => {
        close(p.point, at[i]!.point);
        expect(p.angle).toBeCloseTo(at[i]!.angle);
      });
      expect(places[0]!.angle).not.toBeCloseTo(places[1]!.angle);
    });
    test("past: 'hold' holds at the track's far end", () => {
      const places = placeAlongRun(back, [60, 60, 60], { ...opts, order: 'track', past: 'hold' });
      close(places[2]!.point, { x: 0, y: 0 });
      expect(places.map((p) => p.clipped)).toEqual(['none', 'part', 'past']);
    });
    test('on a non-reversed run it equals reading order', () => {
      expect(run.reversed).toBe(false);
      expect(placeAlongRun(run, [10, 20], { ...opts, order: 'track' })).toEqual(placeAlongRun(run, [10, 20], opts));
    });
    test('on a bottom ccw arc item 0 is the one nearer the shape start', () => {
      const bottom = trackRun(arcShape({ center: C, radius: 100, start: 90, end: 270 }));
      expect(bottom.reversed).toBe(true);
      const start = bottom.shape.at(0).point;
      const [a, b] = placeAlongRun(bottom, [10, 10], { ...opts, order: 'track' });
      const d = (p: Point) => Math.hypot(p.x - start.x, p.y - start.y);
      expect(d(a!.point)).toBeLessThan(d(b!.point));
    });
  });
});
