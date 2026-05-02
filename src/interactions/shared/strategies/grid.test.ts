import { describe, expect, it } from 'vitest';
import { gridSnapStrategy, pointToGridCell } from './grid';
import { IMPERIAL_INCHES } from '../../../units';
import type { GestureContext } from '../../types';

interface Pose { x: number; y: number }

const ctx = {} as unknown as GestureContext<Pose>;

describe('gridSnapStrategy', () => {
  it('snaps a pose to the nearest cell with a bare numeric cell', () => {
    const s = gridSnapStrategy<Pose>(10);
    expect(s.snap({ x: 7, y: 13 }, ctx)).toEqual({ x: 10, y: 10 });
    expect(s.snap({ x: 24, y: -3 }, ctx)).toEqual({ x: 20, y: -0 });
  });

  it('snaps to the resolved base-unit grid when given a tagged cell', () => {
    // 1ft = 12in -> snap to multiples of 12.
    const s = gridSnapStrategy<Pose>({ value: 1, unit: 'ft' }, IMPERIAL_INCHES);
    expect(s.snap({ x: 5, y: 0 }, ctx)).toEqual({ x: 0, y: 0 });
    expect(s.snap({ x: 7, y: 17 }, ctx)).toEqual({ x: 12, y: 12 });
    expect(s.snap({ x: 30, y: 30 }, ctx)).toEqual({ x: 36, y: 36 });
  });

  it('throws when a tagged cell is given without a unit system', () => {
    expect(() => gridSnapStrategy<Pose>({ value: 1, unit: 'ft' })).toThrow(/UnitSystem/);
  });
});

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
});
