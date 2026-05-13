import { describe, expect, it } from 'vitest';
import { countPathAnchors, pathToAnchors } from './anchors';
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

import { anchorsToPath } from './anchors';

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
