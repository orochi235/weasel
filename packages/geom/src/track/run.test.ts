import { describe, expect, test } from 'vitest';
import type { Point } from '../paths/cubicMath';
import { pathFromD } from '../paths/pathFromD';
import { arcShape } from './arc';
import { pathShape } from './path';
import { trackRun } from './run';
import { lineShape } from './shape';

const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(q.y);
};
const C = { x: 0, y: 0 };

describe('trackRun', () => {
  test('a left-to-right line is its own run', () => {
    const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
    expect([r.flipped, r.reversed]).toEqual([false, false]);
    expect(r.at(0.5).angle).toBeCloseTo(0);
    expect(r.length).toBe(100);
  });
  test('a right-to-left line flips and reverses, so it still reads left to right, upright', () => {
    const r = trackRun(lineShape({ x: 100, y: 0 }, { x: 0, y: 0 }));
    expect([r.flipped, r.reversed]).toEqual([true, true]);
    close(r.at(0).point, { x: 0, y: 0 });
    expect(r.at(0.5).angle).toBeCloseTo(0);
  });
  test('a run along the top reads left to right with each item tipped to the curve', () => {
    const r = trackRun(arcShape({ center: C, radius: 100, start: 300, end: 60 }));
    expect([r.flipped, r.reversed]).toEqual([false, false]);
    expect(r.at(0).point.x).toBeLessThan(0);
    expect(r.at(0).angle).toBeCloseTo(-60);
    expect(r.at(0.5).angle).toBeCloseTo(0);
  });
  test('a run along the bottom flips: upright, left to right, up toward the center', () => {
    const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
    expect([r.flipped, r.reversed]).toEqual([true, true]);
    const p = r.at(0);
    expect(p.point.x).toBeLessThan(0);
    expect(r.at(0.5).angle).toBeCloseTo(0);
    expect(p.normal.x * (C.x - p.point.x) + p.normal.y * (C.y - p.point.y)).toBeGreaterThan(0);
  });
  test("an arc's direction does not change where a run places things", () => {
    const cw = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
    const ccw = trackRun(arcShape({ center: C, radius: 100, start: 240, end: 120, direction: 'ccw' }));
    for (const g of [0, 0.3, 1]) close(ccw.at(g).point, cw.at(g).point);
  });
  test("a run centered at 3 o'clock reads top to bottom and one at 9 bottom to top, neither flipped", () => {
    const east = trackRun(arcShape({ center: C, radius: 100, start: 30, end: 150 }));
    const west = trackRun(arcShape({ center: C, radius: 100, start: 210, end: 330 }));
    expect([east.flipped, west.flipped]).toEqual([false, false]);
    expect(east.at(0.5).angle).toBeCloseTo(90);
    expect(west.at(0.5).angle).toBeCloseTo(-90);
  });
  test("on a run across 3 o'clock, only the places whose up points down the screen are turned", () => {
    const east = trackRun(arcShape({ center: C, radius: 100, start: 45, end: 135 }));
    expect(east.flipped).toBe(false);
    expect(east.at(0).angle).toBeCloseTo(45);
    expect(east.at(1).angle).toBeCloseTo(135);
    expect([0, 0.25, 0.5, 0.75, 1].map((g) => east.at(g).turned)).toEqual([false, false, false, true, true]);
    expect(east.at(1).normal.y).toBeGreaterThan(0);
  });
  test('no place on a run along the top or the bottom is turned', () => {
    const top = trackRun(arcShape({ center: C, radius: 100, start: 300, end: 60 }));
    const bottom = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
    for (const g of [0, 0.5, 1]) expect([top.at(g).turned, bottom.at(g).turned]).toEqual([false, false]);
  });
  test('a sub-run measures its own stretch and clamps nearest to its ends', () => {
    const shape = arcShape({ center: C, radius: 100, start: 300, end: 60 });
    const r = trackRun(shape, 0.25, 0.75);
    expect(r.length).toBeCloseTo(shape.length / 2);
    expect(r.nearest(shape.at(0).point).f).toBe(0);
    expect(r.nearest(shape.at(1).point).f).toBe(1);
  });
  test('nearest answers in reading order', () => {
    const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
    expect(r.nearest({ x: -86.6025, y: 50 }).f).toBeCloseTo(0);
  });
  test("side 'path' keeps a downward-facing line in the path's own direction", () => {
    const shape = lineShape({ x: 100, y: 0 }, { x: 0, y: 0 });
    expect(trackRun(shape).flipped).toBe(true);
    const r = trackRun(shape, 0, 1, { side: 'path' });
    expect([r.flipped, r.reversed]).toEqual([false, false]);
    close(r.at(0).point, { x: 100, y: 0 });
  });
  test("side 'flipped' turns an upright run over", () => {
    const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }), 0, 1, { side: 'flipped' });
    expect([r.flipped, r.reversed]).toEqual([true, true]);
    close(r.at(0).point, { x: 100, y: 0 });
    expect(r.at(0.5).angle).toBeCloseTo(180);
  });
  test("auto is judged at 'about'", () => {
    // Out to the right along the top, back to the left along the bottom.
    const shape = pathShape(pathFromD('M0 0 C 150 0 150 100 0 100'))!;
    const early = trackRun(shape, 0, 1, { about: 0.25 });
    const late = trackRun(shape, 0, 1, { about: 0.75 });
    expect([early.flipped, late.flipped]).toEqual([false, true]);
  });
  test('a whole run of a closed shape is closed', () => {
    const circle = arcShape({ center: C, radius: 100, start: 0, end: 0 });
    expect(trackRun(circle).closed).toBe(true);
    expect(trackRun(circle, 1, 0).closed).toBe(true);
    expect(trackRun(circle, 0, 0.5).closed).toBe(false);
    expect(trackRun(lineShape(C, { x: 100, y: 0 })).closed).toBe(false);
  });
  describe('an open nearest runs on past the ends', () => {
    const open = { open: true };
    test('a line extends straight past both ends', () => {
      const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
      expect(r.nearest({ x: -50, y: 10 }, open).f).toBeCloseTo(-0.5);
      expect(r.nearest({ x: 150, y: -10 }, open).f).toBeCloseTo(1.5);
      expect(r.nearest({ x: 150, y: -10 }).f).toBe(1);
    });
    test('an arc extends by angle past both ends, unwrapped about its middle', () => {
      const r = trackRun(arcShape({ center: C, radius: 100, start: 300, end: 60 }));
      expect(r.nearest({ x: -100, y: 0 }, open).f).toBeCloseTo(-0.25);
      expect(r.nearest({ x: 100, y: 0 }, open).f).toBeCloseTo(1.25);
      expect(r.nearest({ x: 100, y: 0 }).f).toBe(1);
    });
    test('a reversed bottom arc answers in reading order', () => {
      const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
      expect(r.nearest({ x: -100, y: 0 }, open).f).toBeCloseTo(-0.25);
      expect(r.nearest({ x: 100, y: 0 }, open).f).toBeCloseTo(1.25);
    });
    test('a ccw arc answers as the cw arc over the same stretch', () => {
      const r = trackRun(arcShape({ center: C, radius: 100, start: 240, end: 120, direction: 'ccw' }));
      expect(r.nearest({ x: -100, y: 0 }, open).f).toBeCloseTo(-0.25);
      expect(r.nearest({ x: 100, y: 0 }, open).f).toBeCloseTo(1.25);
    });
    test("a sub-run of a circle unwraps about the run's middle, not the circle's", () => {
      const r = trackRun(arcShape({ center: C, radius: 100, start: 0, end: 0 }), 0.75, 1);
      expect(r.nearest({ x: 100, y: 0 }, open).f).toBeCloseTo(2);
    });
  });
});

describe('trackRun in a right-to-left direction', () => {
  const rtl = { direction: 'rtl' } as const;
  test('a straight line starts at its right end, items still upright', () => {
    const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }), 0, 1, rtl);
    close(r.at(0).point, { x: 100, y: 0 });
    close(r.at(1).point, { x: 0, y: 0 });
    expect(r.at(0.5).angle).toBeCloseTo(0);
    close(r.at(0.5).tangent, { x: -1, y: 0 });
    close(r.at(0.5).normal, trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 })).at(0.5).normal);
    expect([r.flipped, r.reversed]).toEqual([false, true]);
  });
  test('a run along the top starts at its right end, each item tipped as the left-to-right run tips it', () => {
    const shape = arcShape({ center: C, radius: 100, start: 300, end: 60 });
    const ltr = trackRun(shape);
    const r = trackRun(shape, 0, 1, rtl);
    expect(r.at(0).point.x).toBeGreaterThan(0);
    for (const g of [0, 0.3, 1]) {
      close(r.at(g).point, ltr.at(1 - g).point);
      expect(r.at(g).angle).toBeCloseTo(ltr.at(1 - g).angle);
      expect(r.at(g).turned).toBe(ltr.at(1 - g).turned);
    }
  });
  test('a flipped run along the bottom starts at its right end too', () => {
    const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }), 0, 1, rtl);
    expect(r.flipped).toBe(true);
    expect(r.at(0).point.x).toBeGreaterThan(0);
    expect(r.at(0.5).angle).toBeCloseTo(0);
  });
  test('nearest answers in the reading order', () => {
    const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }), 0, 1, rtl);
    expect(r.nearest({ x: 25, y: 0 }).f).toBeCloseTo(0.75);
  });
});
