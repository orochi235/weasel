import { describe, expect, it } from 'vitest';
import { matchSpacing, measureGaps } from './spacing';
import type { Bounds } from '@weasel-js/core';

const tol = (n: number) => ({ x: n, y: n });
const bx = (x: number, width: number, y = 0, height = 10): Bounds => ({ x, y, width, height });

describe('measureGaps', () => {
  it('measures the gap between two boxes that share a row', () => {
    expect(measureGaps([bx(0, 10), bx(30, 10)], 'x')).toEqual([
      { axis: 'x', min: 10, max: 30, at: 5 },
    ]);
  });

  it('places the marker in the middle of the two boxes’ shared cross range', () => {
    expect(measureGaps([bx(0, 10, 0, 20), bx(30, 10, 10, 40)], 'x')).toEqual([
      { axis: 'x', min: 10, max: 30, at: 15 },
    ]);
  });

  it('skips boxes that share no cross range', () => {
    expect(measureGaps([bx(0, 10, 0), bx(30, 10, 50)], 'x')).toEqual([]);
  });

  it('measures only to the nearest neighbor, so a box in between splits the gap', () => {
    const gaps = measureGaps([bx(0, 10), bx(60, 10), bx(20, 20)], 'x');
    expect(gaps.map((g) => [g.min, g.max])).toEqual([[10, 20], [40, 60]]);
  });

  it('measures the y axis on columns', () => {
    const col = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 25, width: 10, height: 10 }];
    expect(measureGaps(col, 'y')).toEqual([{ axis: 'y', min: 10, max: 25, at: 5 }]);
  });
});

describe('matchSpacing', () => {
  // A..B is a 20 gap; C sits far right in the same row.
  const row = [bx(0, 10), bx(30, 10), bx(100, 10)];

  it('snaps a moved box so its gap to the left neighbor equals an existing gap', () => {
    const m = matchSpacing(bx(58, 10), row, tol(5));
    expect(m.dx).toBe(2); // B ends at 40; 40 + 20 = 60
    expect(m.dy).toBe(0);
    expect(m.gapsX).toEqual([
      { axis: 'x', min: 10, max: 30, at: 5 },
      { axis: 'x', min: 40, max: 60, at: 5 },
    ]);
    expect(m.gapsY).toEqual([]);
  });

  it('snaps to the right neighbor', () => {
    // C starts at 100; 100 - 20 - 10 = 70.
    const m = matchSpacing(bx(73, 10), row, tol(5));
    expect(m.dx).toBe(-3);
    expect(m.gapsX.map((g) => [g.min, g.max])).toEqual([[10, 30], [80, 100]]);
  });

  it('centers a box between two neighbors, so its two gaps are equal', () => {
    const m = matchSpacing(bx(28, 10), [bx(0, 10), bx(50, 10)], tol(5));
    expect(m.dx).toBe(-3);
    expect(m.gapsX.map((g) => [g.min, g.max])).toEqual([[10, 25], [35, 50]]);
  });

  it('ignores a reference gap the moved box now sits inside', () => {
    // M in the B..C gap: B..C (60) is no longer a gap, so 40 + 60 does not
    // pull M onto C.
    const m = matchSpacing(bx(98, 10, 20), [bx(0, 10, 20), bx(30, 10, 20), bx(100, 10, 20)], tol(5));
    expect(m.gapsX.every((g) => g.max - g.min !== 60)).toBe(true);
  });

  it('will not snap a box into overlap with its other neighbor', () => {
    // Left neighbor B ends at 40, so 40 + 20 = 60, but D starts at 65 and M is 10 wide.
    const m = matchSpacing(bx(58, 10), [bx(0, 10), bx(30, 10), bx(65, 10)], tol(3));
    expect(m.dx).toBe(0);
    expect(m.gapsX).toEqual([]);
  });

  it('misses when no placement is within tolerance', () => {
    const m = matchSpacing(bx(50, 10), row, tol(5));
    expect(m).toEqual({ dx: 0, dy: 0, gapsX: [], gapsY: [] });
  });

  it('ignores neighbors outside the moved box’s row', () => {
    const m = matchSpacing(bx(58, 10, 200), row, tol(5));
    expect(m.gapsX).toEqual([]);
  });

  it('snaps on y against a column', () => {
    const col = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 25, width: 10, height: 10 }];
    const m = matchSpacing({ x: 0, y: 52, width: 10, height: 10 }, col, tol(5));
    expect(m.dy).toBe(-2); // 35 + 15 = 50
    expect(m.gapsY.map((g) => [g.min, g.max])).toEqual([[10, 25], [35, 50]]);
  });

  it('draws the moved box’s marker at its snapped cross position', () => {
    // A..B is a 20 x-gap; D..E is a 15 y-gap above M. Both axes snap.
    const targets = [
      bx(0, 10, 0, 20), bx(30, 10, 0, 20),
      { x: 60, y: -40, width: 10, height: 10 }, { x: 60, y: -15, width: 10, height: 10 },
    ];
    const m = matchSpacing({ x: 58, y: 12, width: 10, height: 10 }, targets, tol(5));
    expect([m.dx, m.dy]).toEqual([2, -2]);
    // M ends at y 10..20; its shared range with B is 10..20, not the 12..20 it started with.
    expect(m.gapsX).toContainEqual({ axis: 'x', min: 40, max: 60, at: 15 });
  });

  it('resizes a moving max edge so its gap to the right neighbor equals an existing gap', () => {
    // M spans 50..77; its max edge moves. C at 100: 100 - 20 = 80.
    const m = matchSpacing(bx(50, 27), row, tol(5), { x: 'max', y: null });
    expect(m.dx).toBe(3);
    expect(m.gapsX.map((g) => [g.min, g.max])).toContainEqual([80, 100]);
  });

  it('resizes a moving min edge against the left neighbor', () => {
    // B ends at 40: 40 + 20 = 60. M spans 62..90.
    const m = matchSpacing(bx(62, 28), row, tol(5), { x: 'min', y: null });
    expect(m.dx).toBe(-2);
  });

  it('a resize can match the gap on its own fixed side', () => {
    // A 0..10, M 30..48 (gap 20 on its left); max edge heads for C at 70: 70 - 20 = 50.
    const m = matchSpacing(bx(30, 18), [bx(0, 10), bx(70, 10)], tol(5), { x: 'max', y: null });
    expect(m.dx).toBe(2);
    expect(m.gapsX.map((g) => [g.min, g.max])).toEqual([[10, 30], [50, 70]]);
  });

  it('an axis given null does not snap', () => {
    const m = matchSpacing(bx(58, 10), row, tol(5), { x: null, y: null });
    expect(m.dx).toBe(0);
  });
});
