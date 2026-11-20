import { describe, expect, it } from 'vitest';
import { insetBox, outsetBox } from './inkExtents';

const stroke = { left: 5, top: 5, right: 5, bottom: 5 };

describe('outsetBox', () => {
  it('grows a flipped box outward on the sides it spans', () => {
    // Spans [-50, 0] × [-20, 0]: the ink spans [-55, 5] × [-25, 5].
    expect(outsetBox({ x: 0, y: 0, width: -50, height: -20 }, stroke))
      .toEqual({ x: 5, y: 5, width: -60, height: -30 });
  });

  it('puts each extent on its own side of a flipped box', () => {
    const grown = outsetBox({ x: 0, y: 0, width: -50, height: 10 }, { left: 1, top: 0, right: 3, bottom: 0 });
    expect(grown).toEqual({ x: 3, y: 0, width: -54, height: 10 });
  });

  it('is undone by insetBox on a flipped box', () => {
    const box = { x: 0, y: 0, width: -50, height: -20 };
    expect(insetBox(outsetBox(box, stroke), stroke)).toEqual(box);
  });
});
