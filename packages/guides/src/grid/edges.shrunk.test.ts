import { describe, expect, it } from 'vitest';
import { cellOf, linesNear, resolveGridLines } from './axes';
import { pointToGridCell } from './pointToGridCell';

describe('grid readers at the edges, shrunk from the property tests', () => {
  it('puts a non-finite value in no cell, and near no line', () => {
    // A NaN point had a cell numbered NaN, and with no lines on an axis, cell 0.
    expect(cellOf({ at: [0] }, NaN)).toBeNull();
    expect(cellOf(null, NaN)).toBeNull();
    expect(pointToGridCell({ x: NaN, y: 1 }, 10)).toBeNull();
    expect(linesNear(resolveGridLines(10, (v) => v as number).x!, NaN)).toEqual([]);
  });

  it('answers no line near a value a pitch too fine to count to', () => {
    // A pitch of 5e-324 put both lines at -Infinity.
    expect(linesNear(resolveGridLines(5e-324, (v) => v as number).x!, -8.881784197001252e-16)).toEqual([]);
  });
});
