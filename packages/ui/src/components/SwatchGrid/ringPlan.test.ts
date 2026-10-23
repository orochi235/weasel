import { describe, expect, test } from 'vitest';
import { arcShape, lineShape, trackRun } from '@weasel-js/geom';
import { inwardSign, ringDepths, ringPlan, ringsOf, ringThicknesses, viableRings } from './ringPlan';

const center = { x: 0, y: 0 };

describe('ringPlan', () => {
  test('each palette takes a ring a row while there is room', () => {
    expect(ringPlan([2, 3], 10)).toEqual([2, 3]);
  });
  test('short of room, a palette keeps a ring for each after it, and every one takes at least one', () => {
    expect(ringPlan([2, 3], 3)).toEqual([2, 1]);
    expect(ringPlan([4, 3], 2)).toEqual([1, 1]);
    expect(ringPlan([4, 3], 1)).toEqual([1, 1]);
  });
});

describe('viableRings', () => {
  const arc = arcShape({ center, radius: 100, start: 270, end: 90 });
  const pitched = (n: number, pitch: number) => Array.from({ length: n }, (_, k) => k * pitch);
  test('stops where the next ring would not keep two neighbors apart', () => {
    // Size 20, gap 4: inner corners meet at radius 20 · 24 / 8 = 60, so ring k needs 100 - 24k > 60.
    expect(viableRings(arc, -1, pitched(10, 24), 20, 4)).toBe(2);
    // No gap: they touch anyway, and a ring needs only a pitch of radius.
    expect(viableRings(arc, -1, pitched(10, 20), 20, 0)).toBe(4);
  });
  test('never more than the rows, and every row before anything is measured', () => {
    expect(viableRings(arc, -1, [0], 20, 4)).toBe(1);
    expect(viableRings(arc, -1, pitched(7, 0), 0, 0)).toBe(7);
  });
});

describe('ringDepths', () => {
  test('a ring thicker than a swatch pushes the rings either side of it out by its extra half', () => {
    expect(ringDepths(ringThicknesses([2, 2], [16, 28], 20), 4)).toEqual([0, 24, 52, 80]);
  });
});

describe('inwardSign', () => {
  test("an arc's inside is against its normal, top or bottom", () => {
    const top = arcShape({ center, radius: 100, start: 270, end: 90 });
    const bottom = arcShape({ center, radius: 100, start: 270, end: 90, direction: 'ccw' });
    expect(inwardSign(top, trackRun(top))).toBe(-1);
    expect(inwardSign(bottom, trackRun(bottom))).toBe(-1);
  });
  test('a line stacks its rows down the page', () => {
    const line = lineShape({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(inwardSign(line, trackRun(line))).toBe(-1);
    const back = lineShape({ x: 100, y: 0 }, { x: 0, y: 0 });
    expect(trackRun(back).flipped).toBe(true);
    expect(inwardSign(back, trackRun(back))).toBe(1);
    // Against the flipped normal is down the page here too.
    expect(ringsOf(back, [0, 10])[1]!.shape.at(0).point.y).toBeCloseTo(10);
  });
});

describe('ringsOf', () => {
  test('every ring reads the way the outermost does', () => {
    const bottom = arcShape({ center, radius: 100, start: 270, end: 90, direction: 'ccw' });
    const rings = ringsOf(bottom, [0, 20, 40]);
    expect(rings.map((r) => r.run.flipped)).toEqual([true, true, true]);
    expect(rings.map((r) => Math.round(Math.hypot(r.run.at(0).point.x, r.run.at(0).point.y)))).toEqual([100, 80, 60]);
    expect(rings.map((r) => Math.sign(r.run.at(1).point.x - r.run.at(0).point.x))).toEqual([1, 1, 1]);
  });
});
