import { describe, expect, it } from 'vitest';
import { polygonFromPoints, withCorner } from '@weasel-js/core';
import { serializePathD } from './path-serializer';

describe('serializePathD', () => {
  it('writes a path with corner shapes as the geometry they draw', () => {
    const square = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(serializePathD(square)).toBe('M0 0L10 0L10 10L0 10Z');
    expect(serializePathD(withCorner(square, 1, { shape: 'bevel', radius: 2 })))
      .toBe('M0 0L8 0L10 2L10 10L0 10Z');
  });
});
