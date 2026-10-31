import { nearestLine, type GridLines } from './axes';

type Point = { x: number; y: number };

/** A point of `gridFit` off its line on one axis, by `distance`. */
export interface GridMiss {
  index: number;
  axis: 'x' | 'y';
  distance: number;
}

/**
 * Whether every one of `points` sits within `tolerance` of a line on each
 * axis `lines` has lines on, so on a crossing where it has both: a hanger's
 * holes on a pegboard's. Points and tolerance are in the grid's own space,
 * measured from its origin; `gridLines` resolves a `GridSpacing` into it.
 */
export function gridFit(
  points: readonly Point[], lines: GridLines, tolerance = 1e-6,
): { fits: boolean; misses: GridMiss[] } {
  const misses: GridMiss[] = [];
  points.forEach((p, index) => {
    for (const axis of ['x', 'y'] as const) {
      const a = lines[axis];
      if (!a) continue;
      const near = nearestLine(a, p[axis]);
      const distance = near === null ? Infinity : Math.abs(p[axis] - near);
      if (distance > tolerance) misses.push({ index, axis, distance });
    }
  });
  return { fits: misses.length === 0, misses };
}
