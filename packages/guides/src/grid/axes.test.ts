import { describe, expect, it } from 'vitest';
import { IMPERIAL_INCHES } from '@weasel-js/core';
import { cellOf, linesIn, linesNear, mapLines, nearestLine, resolveGridLines, type AxisLines } from './axes';
import { gridFit } from './fit';
import { gridLines } from './reading';

const bare = (v: unknown) => v as number;

describe('resolveGridLines', () => {
  it('reads one rule for both axes, or one per axis, and none for an axis left out', () => {
    expect(resolveGridLines(10, bare)).toEqual({
      x: { pitch: 10, offset: 0, from: -Infinity, to: Infinity }, y: { pitch: 10, offset: 0, from: -Infinity, to: Infinity },
    });
    expect(resolveGridLines({ y: { at: [30, 0, 10, 10] } }, bare)).toEqual({ x: null, y: { at: [0, 10, 30] } });
  });

  it('gives no lines for a pitch that is not positive', () => {
    expect(resolveGridLines({ x: 0, y: -4 }, bare)).toEqual({ x: null, y: null });
  });

  it('reads every length of an axis in its units, and names the axis that fails', () => {
    expect(gridLines({ x: { pitch: { value: 1, unit: 'ft' }, offset: 6, to: { value: 2, unit: 'ft' } } }, IMPERIAL_INCHES, undefined).x)
      .toEqual({ pitch: 12, offset: 6, from: -Infinity, to: 24 });
    expect(() => gridLines({ y: { value: 1, unit: 'ft' } }, undefined, undefined)).toThrow(/^y axis:/);
  });
});

describe('line queries', () => {
  const ranged: AxisLines = { pitch: 10, offset: 5, from: 5, to: 35 };
  const bays: AxisLines = { at: [0, 40, 55] };

  it('finds the lines either side, nearer first, the upper on a tie', () => {
    expect(linesNear(ranged, 12)).toEqual([15, 5]);
    expect(linesNear(ranged, 20)).toEqual([25, 15]);
    expect(linesNear(bays, 50)).toEqual([55, 40]);
  });

  it('gives the two nearest at an end of the lines', () => {
    expect(linesNear(ranged, 99)).toEqual([35, 25]);
    expect(linesNear(ranged, -99)).toEqual([5, 15]);
    expect(linesNear(bays, 99)).toEqual([55, 40]);
    expect(nearestLine({ at: [7] }, 99)).toBe(7);
  });

  it('lists the lines in a span', () => {
    expect(linesIn(ranged, 0, 26)).toEqual([5, 15, 25]);
    expect(linesIn(bays, 1, 55)).toEqual([40, 55]);
  });

  it('finds the cell between two lines, and none outside them', () => {
    expect(cellOf(ranged, 16)).toEqual({ index: 1, lo: 15, hi: 25 });
    expect(cellOf(ranged, 36)).toBeNull();
    expect(cellOf(bays, 41)).toEqual({ index: 1, lo: 40, hi: 55 });
    expect(cellOf(null, 41)).toEqual({ index: 0, lo: -Infinity, hi: Infinity });
  });

  it('moves every line through a scale and shift', () => {
    expect(mapLines(ranged, 2, 1)).toEqual({ pitch: 20, offset: 11, from: 11, to: 71 });
    expect(mapLines(bays, -1, 0)).toEqual({ at: [-55, -40, 0] });
  });
});

describe('gridFit', () => {
  const pegboard = gridLines(25.4, undefined, undefined);

  it('fits points that sit on crossings, within the tolerance', () => {
    expect(gridFit([{ x: 25.4, y: 50.8 }, { x: 76.6, y: 50.4 }], pegboard, 1)).toEqual({ fits: true, misses: [] });
  });

  it('names each point and axis that misses, and by how much', () => {
    const { fits, misses } = gridFit([{ x: 25.4, y: 40 }], pegboard, 1);
    expect(fits).toBe(false);
    expect(misses).toHaveLength(1);
    expect(misses[0]).toMatchObject({ index: 0, axis: 'y' });
    expect(misses[0]!.distance).toBeCloseTo(10.8, 9);
  });

  it('checks only the axes the grid has lines on', () => {
    expect(gridFit([{ x: 3, y: 20 }], gridLines({ y: 10 }, undefined, undefined)).fits).toBe(true);
  });
});
