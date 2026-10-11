import { describe, expect, it } from 'vitest';
import { anchorsToPath, countPathAnchors, pathToAnchors, type PenAnchor } from './anchors';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('pathToAnchors', () => {
  it('extracts a single open subpath of corner anchors from M+L+L', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toEqual([[
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]]);
    expect(closed).toEqual([false]);
  });

  it('marks the subpath closed when it ends with Z', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .build();
    const { closed } = pathToAnchors(path);
    expect(closed).toEqual([true]);
  });

  it('extracts handles from a cubic segment as outHandle/inHandle on adjacent anchors', () => {
    const path = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(20, 0, 80, 100, 100, 100)
      .build();
    const { anchors } = pathToAnchors(path);
    expect(anchors[0]).toHaveLength(2);
    expect(anchors[0][0]).toEqual({ x: 0, y: 0, outHandle: { x: 20, y: 0 } });
    expect(anchors[0][1]).toEqual({ x: 100, y: 100, inHandle: { x: 80, y: 100 } });
  });

  it('produces multiple subpaths from multiple M commands', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0)
      .moveTo(50, 50).lineTo(60, 50)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(anchors[1]).toEqual([{ x: 50, y: 50 }, { x: 60, y: 50 }]);
    expect(closed).toEqual([false, false]);
  });

  it('returns empty arrays for an empty path', () => {
    const path = new PathBuilder().build();
    expect(pathToAnchors(path)).toEqual({ anchors: [], closed: [] });
  });
});


describe('anchorsToPath', () => {
  it('serializes a single open subpath of corner anchors to M+L', () => {
    const path = anchorsToPath(
      [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
      [false],
    );
    expect(path.kind).toBe('polygon');
    // M 0 0 L 10 0 L 10 10
    expect(Array.from(path.commands)).toEqual([0, 1, 1]); // PATH_M=0, PATH_L=1
    expect(Array.from(path.coords)).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it('serializes a closed subpath with trailing Z', () => {
    const path = anchorsToPath(
      [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
      [true],
    );
    // M 0 0 L 10 0 L 10 10 Z
    expect(Array.from(path.commands)).toEqual([0, 1, 1, 4]); // PATH_Z=4
  });

  it('serializes anchors with handles to C commands', () => {
    const path = anchorsToPath(
      [[
        { x: 0, y: 0, outHandle: { x: 20, y: 0 } },
        { x: 100, y: 100, inHandle: { x: 80, y: 100 } },
      ]],
      [false],
    );
    // M 0 0 C 20 0 80 100 100 100
    expect(Array.from(path.commands)).toEqual([0, 2]); // PATH_M=0, PATH_C=2
    expect(Array.from(path.coords)).toEqual([0, 0, 20, 0, 80, 100, 100, 100]);
  });

  it('round-trips: anchorsToPath(pathToAnchors(p)) yields equivalent geometry', () => {
    const original = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(20, 0, 80, 100, 100, 100)
      .lineTo(150, 50)
      .build();
    const { anchors, closed } = pathToAnchors(original);
    const rebuilt = anchorsToPath(anchors, closed);
    expect(Array.from(rebuilt.commands)).toEqual(Array.from(original.commands));
    expect(Array.from(rebuilt.coords)).toEqual(Array.from(original.coords));
  });
});

describe('a closed subpath whose last curve returns to its start', () => {
  const loop: PenAnchor[] = [
    { x: 0, y: 0, inHandle: { x: -4, y: 6 }, outHandle: { x: 4, y: -6 } },
    { x: 20, y: 0, inHandle: { x: 16, y: -6 }, outHandle: { x: 24, y: 6 } },
    { x: 10, y: 20, inHandle: { x: 18, y: 20 }, outHandle: { x: 2, y: 20 } },
  ];

  it('decodes to the anchors it was built from', () => {
    expect(pathToAnchors(anchorsToPath([loop], [true]))).toEqual({ anchors: [loop], closed: [true] });
  });

  it('gives the first anchor both handles, so it reads as smooth', () => {
    const [first] = pathToAnchors(anchorsToPath([loop], [true])).anchors[0];
    expect(first.inHandle).toEqual({ x: -4, y: 6 });
    expect(first.outHandle).toEqual({ x: 4, y: -6 });
  });

  it('decodes a one-anchor loop to one anchor', () => {
    const drop: PenAnchor[] = [{ x: 0, y: 0, inHandle: { x: -5, y: 10 }, outHandle: { x: 5, y: 10 } }];
    expect(pathToAnchors(anchorsToPath([drop], [true]))).toEqual({ anchors: [drop], closed: [true] });
  });

  it('writes back the same path when only the last anchor curves into the close', () => {
    const half: PenAnchor[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 20, outHandle: { x: 2, y: 20 } },
    ];
    const path = anchorsToPath([half], [true]);
    const decoded = pathToAnchors(path);
    expect(decoded.anchors[0]).toHaveLength(3);
    const again = anchorsToPath(decoded.anchors, decoded.closed);
    expect(Array.from(again.commands)).toEqual(Array.from(path.commands));
    expect(Array.from(again.coords)).toEqual(Array.from(path.coords));
  });

  it('leaves an open path that ends where it began as it is', () => {
    const open = new PathBuilder().moveTo(0, 0).curveTo(5, 5, 5, -5, 0, 0).build();
    expect(pathToAnchors(open).anchors[0]).toHaveLength(2);
  });

  it('leaves a closing curve that stops short of the start as its own anchor', () => {
    const short = new PathBuilder().moveTo(0, 0).lineTo(10, 0).curveTo(10, 5, 1, 5, 1, 0).close().build();
    expect(pathToAnchors(short).anchors[0]).toHaveLength(3);
  });
});

describe('countPathAnchors', () => {
  it('returns 4 for a RectPath (one anchor per corner)', () => {
    expect(countPathAnchors(rectPath(0, 0, 10, 10))).toBe(4);
  });

  it('counts M + L commands in a polygon-from-points (Z does not count)', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    // polygonFromPoints emits M + L + L + Z → 3 anchors
    expect(countPathAnchors(p)).toBe(3);
  });

  it('counts C and Q commands as one anchor each (destination point)', () => {
    const p = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .curveTo(20, 0, 20, 10, 10, 10)
      .quadTo(0, 20, 0, 10)
      .build();
    // M + L + C + Q = 4 anchors
    expect(countPathAnchors(p)).toBe(4);
  });

  it('sums anchors across multiple contours', () => {
    const p = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .moveTo(20, 20).lineTo(30, 20).close()
      .build();
    // contour 1: M + L + L = 3; contour 2: M + L = 2; total 5
    expect(countPathAnchors(p)).toBe(5);
  });
});

import { isAnchorSmooth } from './anchors';

describe('isAnchorSmooth', () => {
  it('returns true when in-handle, anchor, and out-handle are collinear', () => {
    // Anchor at (50, 50), in-handle at (40, 40), out-handle at (60, 60).
    // Line is y = x. Cross product magnitude near zero.
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 40, y: 40 },
      outHandle: { x: 60, y: 60 },
    })).toBe(true);
  });

  it('returns false when handles deviate from collinear', () => {
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 40, y: 50 },  // pointing left
      outHandle: { x: 50, y: 60 }, // pointing down — perpendicular
    })).toBe(false);
  });

  it('returns false when either handle is missing', () => {
    expect(isAnchorSmooth({ x: 50, y: 50, outHandle: { x: 60, y: 50 } })).toBe(false);
    expect(isAnchorSmooth({ x: 50, y: 50, inHandle: { x: 40, y: 50 } })).toBe(false);
    expect(isAnchorSmooth({ x: 50, y: 50 })).toBe(false);
  });

  it('returns false when a handle is at zero distance from the anchor', () => {
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 50, y: 50 },        // zero-length
      outHandle: { x: 60, y: 50 },
    })).toBe(false);
  });
});
