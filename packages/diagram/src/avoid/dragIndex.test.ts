import { describe, expect, it } from 'vitest';
import { rectShape } from './avoidFixture';
import { DragIndex } from './dragIndex';

describe('DragIndex.frame', () => {
  it('keeps a moved box that is not finite out of the search limit', () => {
    const a = rectShape('a', 0, 0);
    const limit = { x: -200, y: -200, width: 500, height: 460 };
    const drag = new DragIndex({ obstacles: [a], edges: [] }, new Map(), 10, limit);
    const frame = drag.frame([{ ...a, box: { x: Number.NaN, y: 0, width: 100, height: Infinity } }]);
    expect(frame.limit).toEqual(limit);
  });
});
