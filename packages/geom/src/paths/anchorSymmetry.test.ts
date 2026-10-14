import { describe, expect, it } from 'vitest';
import type { Affine } from '../affine';
import type { AnchorSet } from './anchorEdits';
import { anchorMirror, moveHandleMirrored, translateAnchorsMirrored } from './anchorSymmetry';

/** Reflection across the vertical line x = 50. */
const ACROSS_50: Affine = [-1, 0, 0, 1, 100, 0];

/** A closed curved shape symmetric about x = 50: a bottom point on the axis, a
 *  top point on the axis, and a lobe either side whose handles mirror. */
function lobes(): AnchorSet {
  return {
    anchors: [[
      { x: 50, y: 100, inHandle: { x: 70, y: 90 }, outHandle: { x: 30, y: 90 } },
      { x: 10, y: 40, inHandle: { x: 10, y: 70 }, outHandle: { x: 10, y: 20 } },
      { x: 50, y: 30 },
      { x: 90, y: 40, inHandle: { x: 90, y: 20 }, outHandle: { x: 90, y: 70 } },
    ]],
    closed: [true],
  };
}

describe('anchorMirror', () => {
  it('pairs each anchor with its mirror image, axis anchors with themselves', () => {
    expect(anchorMirror(lobes(), ACROSS_50)?.partners).toEqual([0, 3, 2, 1]);
  });

  it('answers null for a path that is not its own mirror image', () => {
    const set = lobes();
    set.anchors[0][3].x = 91;
    expect(anchorMirror(set, ACROSS_50)).toBeNull();
  });

  it('answers null when the anchors mirror but a handle does not', () => {
    const set = lobes();
    set.anchors[0][1].outHandle = { x: 15, y: 20 };
    expect(anchorMirror(set, ACROSS_50)).toBeNull();
  });

  it('pairs within the tolerance it is given', () => {
    const set = lobes();
    set.anchors[0][3].x = 90.001;
    set.anchors[0][3].inHandle!.x = 90.001;
    set.anchors[0][3].outHandle!.x = 90.001;
    expect(anchorMirror(set, ACROSS_50)).toBeNull();
    expect(anchorMirror(set, ACROSS_50, 0.01)?.partners).toEqual([0, 3, 2, 1]);
  });
});

describe('translateAnchorsMirrored', () => {
  it('moves the partner by the mirrored delta, handles included', () => {
    const set = lobes();
    const mirror = anchorMirror(set, ACROSS_50)!;
    translateAnchorsMirrored(set, [1], -5, 3, [mirror]);
    const [, left, , right] = set.anchors[0];
    expect(left).toMatchObject({ x: 5, y: 43 });
    expect(right).toMatchObject({ x: 95, y: 43 });
    expect(right.inHandle).toEqual({ x: 95, y: 23 });
    expect(anchorMirror(set, ACROSS_50)?.partners).toEqual([0, 3, 2, 1]);
  });

  it('holds an anchor its own partner to the axis', () => {
    const set = lobes();
    const mirror = anchorMirror(set, ACROSS_50)!;
    translateAnchorsMirrored(set, [2], 8, -4, [mirror]);
    expect(set.anchors[0][2]).toMatchObject({ x: 50, y: 26 });
  });

  it('moves a selected pair as dragged, without mirroring either into the other', () => {
    const set = lobes();
    const mirror = anchorMirror(set, ACROSS_50)!;
    translateAnchorsMirrored(set, [1, 3], 0, 10, [mirror]);
    expect(set.anchors[0][1]).toMatchObject({ x: 10, y: 50 });
    expect(set.anchors[0][3]).toMatchObject({ x: 90, y: 50 });
  });

  it('is a plain translate with no mirrors', () => {
    const set = lobes();
    translateAnchorsMirrored(set, [1], 1, 1, []);
    expect(set.anchors[0][3]).toMatchObject({ x: 90, y: 40 });
  });
});

describe('moveHandleMirrored', () => {
  it('moves the partner handle the mirror image of this one maps to', () => {
    const set = lobes();
    const mirror = anchorMirror(set, ACROSS_50)!;
    moveHandleMirrored(set, 1, 'out', 0, 10, true, [mirror]);
    expect(set.anchors[0][1].outHandle).toEqual({ x: 0, y: 10 });
    expect(set.anchors[0][3].inHandle).toEqual({ x: 100, y: 10 });
    expect(anchorMirror(set, ACROSS_50)).not.toBeNull();
  });

  it('moves the opposite handle of an axis anchor', () => {
    const set = lobes();
    const mirror = anchorMirror(set, ACROSS_50)!;
    moveHandleMirrored(set, 0, 'out', 20, 95, false, [mirror]);
    expect(set.anchors[0][0].outHandle).toEqual({ x: 20, y: 95 });
    expect(set.anchors[0][0].inHandle).toEqual({ x: 80, y: 95 });
  });
});
