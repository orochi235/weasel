import { describe, expect, it } from 'vitest';
import { IMPERIAL_INCHES } from '@weasel-js/core';
import { pointToGridCell } from './pointToGridCell';

const cell = (col: number, row: number, x: number, y: number, width: number, height: number) =>
  ({ col, row, box: { x, y, width, height } });

describe('pointToGridCell', () => {
  it('returns the cell containing the point with a bare numeric spacing', () => {
    expect(pointToGridCell({ x: 0, y: 0 }, 10)).toEqual(cell(0, 0, 0, 0, 10, 10));
    expect(pointToGridCell({ x: 9.9, y: 10 }, 10)).toEqual(cell(0, 1, 0, 10, 10, 10));
    expect(pointToGridCell({ x: 25, y: -1 }, 10)).toEqual(cell(2, -1, 20, -10, 10, 10));
  });

  it('resolves tagged spacings through the unit system', () => {
    // 1ft = 12in; cell of width/height 12 base units.
    expect(pointToGridCell({ x: 13, y: 11 }, { value: 1, unit: 'ft' }, IMPERIAL_INCHES)).toMatchObject({ col: 1, row: 0 });
    expect(pointToGridCell({ x: -1, y: 24 }, { value: 1, unit: 'ft' }, IMPERIAL_INCHES)).toMatchObject({ col: -1, row: 2 });
  });

  it('shifts the lattice when an origin is supplied', () => {
    expect(pointToGridCell({ x: 5, y: 5 }, 10, undefined, { x: 5, y: 5 })).toEqual(cell(0, 0, 5, 5, 10, 10));
    expect(pointToGridCell({ x: 4, y: 16 }, 10, undefined, { x: 5, y: 5 })).toEqual(cell(-1, 1, -5, 15, 10, 10));
  });

  it('throws when a tagged spacing is given without a unit system', () => {
    expect(() => pointToGridCell({ x: 0, y: 0 }, { value: 1, unit: 'ft' })).toThrow(/UnitSystem/);
  });

  it('finds a cell on a grid with different pitches', () => {
    expect(pointToGridCell({ x: 25, y: 25 }, { x: 10, y: 4 })).toEqual(cell(2, 6, 20, 24, 10, 4));
  });

  it('finds an uneven cell between explicit lines, and none outside them', () => {
    const bays = { x: { at: [0, 40, 55, 100] }, y: 10 };
    expect(pointToGridCell({ x: 50, y: 3 }, bays)).toEqual(cell(1, 0, 40, 0, 15, 10));
    expect(pointToGridCell({ x: 120, y: 3 }, bays)).toBeNull();
  });

  it('numbers cells from the offset and stops at the range', () => {
    const spacing = { x: { pitch: 10, offset: 5, from: 5, to: 35 }, y: 10 };
    expect(pointToGridCell({ x: 6, y: 0 }, spacing)).toEqual(cell(0, 0, 5, 0, 10, 10));
    expect(pointToGridCell({ x: 34, y: 0 }, spacing)).toEqual(cell(2, 0, 25, 0, 10, 10));
    expect(pointToGridCell({ x: 36, y: 0 }, spacing)).toBeNull();
    expect(pointToGridCell({ x: 4, y: 0 }, spacing)).toBeNull();
  });

  it('makes an axis with no lines one endless cell', () => {
    expect(pointToGridCell({ x: 123, y: 25 }, { y: 10 })).toEqual(cell(0, 2, -Infinity, 20, Infinity, 10));
  });
});
