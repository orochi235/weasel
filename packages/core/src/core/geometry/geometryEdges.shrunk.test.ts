/** Counterexamples the second-pass geometry property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { boxToBox } from '@weasel-js/geom';
import { unionAABB, unionBounds } from './unionBounds';
import { RECT_POSE_DESCRIPTOR, remapRotatedLeaf } from './poseDescriptor';

describe('geometry edges, shrunk counterexamples', () => {
  it('a remap from a box of subnormal extent keeps that axis\'s scale, as from one of none', () => {
    const out = RECT_POSE_DESCRIPTOR.remapBounds({ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 1, height: 5e-324 }, { x: 0, y: 0, width: 0, height: 8.881784197001252e-16 });
    expect(out).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(boxToBox(0, 0, 5e-324, 1, 0, 0, 1, 1)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('a leaf in a group remapped from a subnormal width onto no height stays finite', () => {
    const next = remapRotatedLeaf({ x: 0, y: 0, width: 0.1, height: 0.1, rotation: 0 }, { x: 0, y: 0, width: 5e-324, height: 1 }, { x: 0, y: 0, width: 1, height: 0 });
    expect([next.x, next.y, next.width, next.height, next.rotation].every(Number.isFinite)).toBe(true);
    expect(next.width).toBeCloseTo(0.1);
    expect(next.height).toBe(0);
  });

  it('a union skips a box with a corner that is not finite, and of only such boxes is null', () => {
    expect(unionBounds([{ x: 0, y: 0, width: NaN, height: 0 }])).toBeNull();
    expect(unionAABB([{ x: 0, y: 0, width: Infinity, height: 1 }, { x: 1, y: 2, width: 3, height: 4 }])).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});
