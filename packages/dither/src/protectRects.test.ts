import { describe, expect, it } from 'vitest';
import { protectRects } from './protectRects';

describe('protectRects', () => {
  const grid = { pitch: 0.4, origin: { x: 10, y: 20 } };

  it('maps each protected item to dot space', () => {
    const items = [{ id: 'a', r: { x: 10, y: 20, width: 4, height: 2 } }, { id: 'b', r: null }];
    expect(protectRects(items, (i) => i.r, grid)).toEqual([{ x: 0, y: 0, width: 10, height: 5 }]);
  });

  it('skips items the predicate turns down', () => {
    expect(protectRects([1, 2], () => false, grid)).toEqual([]);
  });
});
