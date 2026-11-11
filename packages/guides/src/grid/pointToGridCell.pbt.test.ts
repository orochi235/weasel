import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import type { GridSpacing } from './axes';
import { pointToGridCell } from './pointToGridCell';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 2);

/** One pitch for both axes, one each, or one axis alone. */
const spacing = fc.oneof(
  posEighth(20).map((p): GridSpacing => p),
  fc.record({ x: posEighth(20), y: posEighth(20) }).map((s): GridSpacing => s),
  fc.record({ x: posEighth(20) }).map((s): GridSpacing => s),
);
const pitchOf = (s: GridSpacing, axis: 'x' | 'y'): number | undefined =>
  typeof s === 'number' ? s : (s as { x?: number; y?: number })[axis];

describe('pointToGridCell, property', () => {
  it('answers the cell holding the point, a pitch wide on each axis with lines, without end on one without', () => {
    const t = tally();
    fc.assert(fc.property(spacing, eighth(500), eighth(500), eighth(50), eighth(50), (s, x, y, ox, oy) => {
      const cell = pointToGridCell({ x, y }, s, undefined, { x: ox, y: oy })!;
      expect(cell).not.toBeNull();
      const { box } = cell;
      // A rect without end starts at -Infinity and is Infinity wide, which do not sum.
      const end = (start: number, size: number) => (size === Infinity ? Infinity : start + size);
      expect(box.x <= x && x < end(box.x, box.width)).toBe(true);
      expect(box.y <= y && y < end(box.y, box.height)).toBe(true);
      for (const [axis, size, at, o] of [['x', box.width, box.x, ox], ['y', box.height, box.y, oy]] as const) {
        const p = pitchOf(s, axis);
        if (p === undefined) {
          t.count('no lines');
          expect(size).toBe(Infinity);
          continue;
        }
        expect(size).toBe(p);
        expect(at).toBe(o + (axis === 'x' ? cell.col : cell.row) * p);
      }
    }), RUNS);
    t.atLeast('no lines', 30);
  }, TIMEOUT);

  it('moving the origin a whole cell renumbers the cell and keeps its box', () => {
    fc.assert(fc.property(spacing.filter((s) => pitchOf(s, 'y') !== undefined), eighth(500), eighth(500), fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), (s, x, y, i, j) => {
      const px = pitchOf(s, 'x')!;
      const py = pitchOf(s, 'y')!;
      const a = pointToGridCell({ x, y }, s)!;
      const b = pointToGridCell({ x, y }, s, undefined, { x: i * px, y: j * py })!;
      expect(b.box).toEqual(a.box);
      expect([b.col, b.row]).toEqual([a.col - i, a.row - j]);
    }), RUNS);
  }, TIMEOUT);
});
