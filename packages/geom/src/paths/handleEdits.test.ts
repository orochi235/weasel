import { describe, expect, it } from 'vitest';
import { handleAlongItsAngle, handleAtItsLength, makeHandlesSymmetric, retractHandles } from './handleEdits';
import { anchorsToPath, isAnchorSmooth, pathToAnchors } from './anchors';
import { PATH_L } from '../commands';
import type { AnchorSet } from './anchorEdits';

/** Open three-anchor curve whose middle anchor has a lopsided corner. */
function corner(): AnchorSet {
  return {
    anchors: [[
      { x: 0, y: 0, outHandle: { x: 10, y: 20 } },
      { x: 50, y: 50, inHandle: { x: 40, y: 50 }, outHandle: { x: 50, y: 80 } },
      { x: 100, y: 0, inHandle: { x: 90, y: 20 } },
    ]],
    closed: [false],
  };
}

describe('retractHandles', () => {
  it('collapses the chosen anchors\' handles and leaves the others alone', () => {
    const set = corner();
    expect(retractHandles(set, [1])).toBe(true);
    const [a, b, c] = set.anchors[0];
    expect(b.inHandle).toBeUndefined();
    expect(b.outHandle).toBeUndefined();
    expect(a.outHandle).toEqual({ x: 10, y: 20 });
    expect(c.inHandle).toEqual({ x: 90, y: 20 });
  });

  it('turns a segment straight once both its ends are retracted', () => {
    const set = corner();
    retractHandles(set, [0, 1, 2]);
    const path = anchorsToPath(set.anchors, set.closed);
    expect([...path.commands].slice(1).every((c) => c === PATH_L)).toBe(true);
  });

  it('reports no change when there was nothing to retract', () => {
    const set: AnchorSet = { anchors: [[{ x: 0, y: 0 }, { x: 10, y: 0 }]], closed: [false] };
    expect(retractHandles(set, [0, 1, 7])).toBe(false);
  });

  it('counts a handle already sitting on its anchor as retracted', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0, outHandle: { x: 0, y: 0 } }, { x: 10, y: 0, inHandle: { x: 8, y: 4 } }]],
      closed: [false],
    };
    expect(retractHandles(set, [0])).toBe(false);
  });
});

describe('makeHandlesSymmetric', () => {
  it('gives the anchor equal, opposite handles along the bisector of its two', () => {
    const set = corner();
    expect(makeHandlesSymmetric(set, [1])).toBe(true);
    const b = set.anchors[0][1];
    expect(isAnchorSmooth(b)).toBe(true);
    const inLen = Math.hypot(b.inHandle!.x - b.x, b.inHandle!.y - b.y);
    const outLen = Math.hypot(b.outHandle!.x - b.x, b.outHandle!.y - b.y);
    expect(inLen).toBeCloseTo(20, 9);
    expect(outLen).toBeCloseTo(20, 9);
    // Out pointed down (0, 1); the in-handle turned around pointed right (1, 0).
    expect(b.outHandle!.x - b.x).toBeCloseTo(20 / Math.SQRT2, 9);
    expect(b.outHandle!.y - b.y).toBeCloseTo(20 / Math.SQRT2, 9);
  });

  it('mirrors a lone handle onto the other side', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0 }, { x: 50, y: 0, outHandle: { x: 60, y: 10 } }, { x: 100, y: 0 }]],
      closed: [false],
    };
    makeHandlesSymmetric(set, [1]);
    expect(set.anchors[0][1].inHandle).toEqual({ x: 40, y: -10 });
  });

  it('skips the ends of an open subpath but not of a closed one', () => {
    const open = corner();
    expect(makeHandlesSymmetric(open, [0, 2])).toBe(false);
    const closed = corner();
    closed.closed[0] = true;
    expect(makeHandlesSymmetric(closed, [0])).toBe(true);
    expect(isAnchorSmooth(closed.anchors[0][0])).toBe(true);
  });

  it('reports no change on an anchor that is already symmetric', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0 }, { x: 50, y: 0, inHandle: { x: 40, y: 0 }, outHandle: { x: 60, y: 0 } }, { x: 100, y: 0 }]],
      closed: [false],
    };
    expect(makeHandlesSymmetric(set, [1])).toBe(false);
  });

  it('round-trips through the path encoding as a smooth anchor', () => {
    const set = corner();
    makeHandlesSymmetric(set, [1]);
    const back = pathToAnchors(anchorsToPath(set.anchors, set.closed));
    expect(isAnchorSmooth(back.anchors[0][1])).toBe(true);
  });
});

describe('handleAlongItsAngle', () => {
  it('projects the pointer onto the handle\'s own direction', () => {
    expect(handleAlongItsAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 17 })).toEqual({ x: 30, y: 0 });
  });

  it('shrinks the handle onto the anchor rather than flipping it', () => {
    expect(handleAlongItsAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -20, y: 5 })).toEqual({ x: 0, y: 0 });
  });

  it('lets a handle with no length follow the pointer', () => {
    expect(handleAlongItsAngle({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 9, y: 1 })).toEqual({ x: 9, y: 1 });
  });
});

describe('handleAtItsLength', () => {
  it('keeps the length and aims at the pointer', () => {
    const p = handleAtItsLength({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 50 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it('stays put when the pointer sits on the anchor', () => {
    expect(handleAtItsLength({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 10, y: 0 });
  });
});
