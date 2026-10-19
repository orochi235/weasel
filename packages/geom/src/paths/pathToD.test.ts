import { describe, expect, it } from 'vitest';
import { polygonFromPoints } from './builder';
import { withCorner } from './cornerSpec';
import { pathFromD } from './pathFromD';
import { pathToD } from './pathToD';

describe('pathToD', () => {
  it('writes a path with corner shapes as the geometry they draw', () => {
    const square = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(pathToD(square)).toBe('M0 0L10 0L10 10L0 10Z');
    expect(pathToD(withCorner(square, 1, { shape: 'bevel', radius: 2 })))
      .toBe('M0 0L8 0L10 2L10 10L0 10Z');
  });

  it('round-trips through pathFromD', () => {
    const d = 'M0 0L1 0C1 0.5 0.5 1 0 1Q-0.25 0.5 0 0Z';
    expect(pathToD(pathFromD(d))).toBe(d);
  });
});
