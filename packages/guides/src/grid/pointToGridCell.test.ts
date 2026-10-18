import { describe, expect, it } from 'vitest';
import { IMPERIAL_INCHES } from '@weasel-js/core';
import { pointToGridCell } from './pointToGridCell';

describe('pointToGridCell', () => {
  it('returns the integer cell containing the point with a bare numeric spacing', () => {
    expect(pointToGridCell({ x: 0, y: 0 }, 10)).toEqual({ col: 0, row: 0 });
    expect(pointToGridCell({ x: 9.9, y: 10 }, 10)).toEqual({ col: 0, row: 1 });
    expect(pointToGridCell({ x: 25, y: -1 }, 10)).toEqual({ col: 2, row: -1 });
  });

  it('resolves tagged spacings through the unit system', () => {
    // 1ft = 12in; cell of width/height 12 base units.
    expect(
      pointToGridCell({ x: 13, y: 11 }, { value: 1, unit: 'ft' }, IMPERIAL_INCHES),
    ).toEqual({ col: 1, row: 0 });
    expect(
      pointToGridCell({ x: -1, y: 24 }, { value: 1, unit: 'ft' }, IMPERIAL_INCHES),
    ).toEqual({ col: -1, row: 2 });
  });

  it('shifts the lattice when an origin is supplied', () => {
    expect(pointToGridCell({ x: 5, y: 5 }, 10, undefined, { x: 5, y: 5 })).toEqual({
      col: 0,
      row: 0,
    });
    expect(pointToGridCell({ x: 4, y: 16 }, 10, undefined, { x: 5, y: 5 })).toEqual({
      col: -1,
      row: 1,
    });
  });

  it('throws when a tagged spacing is given without a unit system', () => {
    expect(() => pointToGridCell({ x: 0, y: 0 }, { value: 1, unit: 'ft' })).toThrow(/UnitSystem/);
  });

  it('finds a cell on a grid with different pitches', () => {
    expect(pointToGridCell({ x: 25, y: 25 }, { x: 10, y: 4 })).toEqual({ col: 2, row: 6 });
  });
});
