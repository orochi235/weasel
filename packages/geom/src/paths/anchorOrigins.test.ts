import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { deleteAnchorsAt, insertAnchorOnSegment, openSubpathAt, translateAnchorBy } from './anchorEdits';
import { editAnchorSetTracked, remapPointValues } from './anchorOrigins';
import { anchorOriginsOf } from './anchorValues';
import { reverseAnchors } from './nearestAnchor';

/** Closed square, points 0..3 at its corners. */
function square(): PolygonPath {
  return new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
}

/** Open curve, then a line: points are anchor, out handle, in handle, anchor, anchor. */
function curveThenLine(): PolygonPath {
  return new PathBuilder().moveTo(0, 0).curveTo(0, 10, 10, 10, 10, 0).lineTo(20, 0).build();
}

/** What each point of the edited path reads from a per-point array holding its own index. */
function carried(path: PolygonPath, edit: Parameters<typeof editAnchorSetTracked>[1]): number[] {
  const tracked = editAnchorSetTracked(path, edit)!;
  expect(tracked.origins).toHaveLength(tracked.path.coords.length / 2);
  return remapPointValues(Array.from({ length: path.coords.length / 2 }, (_, i) => i), tracked.origins);
}

describe('editAnchorSetTracked', () => {
  it('answers null when the edit changes nothing', () => {
    expect(editAnchorSetTracked(square(), () => false)).toBeNull();
  });

  it('keeps every point its own through a move', () => {
    expect(carried(square(), (set) => translateAnchorBy(set, 2, 5, 5))).toEqual([0, 1, 2, 3]);
  });

  it('blends an inserted point from the anchors either side, by where it lands', () => {
    expect(carried(square(), (set) => insertAnchorOnSegment(set, { sub: 0, segIdx: 1, t: 0.25 }) !== -1))
      .toEqual([0, 1, 1.25, 2, 3]);
  });

  it('blends a point inserted on a closing segment from the last anchor and the first', () => {
    expect(carried(square(), (set) => insertAnchorOnSegment(set, { sub: 0, segIdx: 3, t: 0.5 }) !== -1))
      .toEqual([0, 1, 2, 3, 1.5]);
  });

  it('closes the gap a deleted point leaves', () => {
    // Deleting corner 1 joins 0 → 2 with a line, since both sides of it were lines.
    expect(carried(square(), (set) => deleteAnchorsAt(set, [1]))).toEqual([0, 2, 3]);
  });

  it('gives a refitted handle its anchor', () => {
    // Deleting the anchor at (10, 0) refits 0 → (20, 0): anchor 0, its out handle (moved,
    // still point 1), the far anchor's new in handle, then that anchor.
    expect(carried(curveThenLine(), (set) => deleteAnchorsAt(set, [1]))).toEqual([0, 1, 4, 4]);
  });

  it('keeps a handle that survives a split, and gives a new anchor\'s handles its blend', () => {
    const out = carried(curveThenLine(), (set) => insertAnchorOnSegment(set, { sub: 0, segIdx: 0, t: 0.5 }) !== -1);
    // anchor 0, its out handle (1), new in, new anchor, new out, 3's in handle (2), 3, 4.
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
    expect(out[2]).toBe(out[3]);
    expect(out[4]).toBe(out[3]);
    expect(out[3]).toBeCloseTo(1.5);
    expect(out.slice(5)).toEqual([2, 3, 4]);
  });

  it('follows the points of a cut subpath around to their new places', () => {
    // Cut at corner 2: it starts the subpath, and a second anchor on it ends it.
    expect(carried(square(), (set) => openSubpathAt(set, 2))).toEqual([2, 3, 0, 1, 2]);
  });

  it('follows a point whose quadratic segment an edit re-encodes as a cubic', () => {
    const quad = new PathBuilder().moveTo(0, 0).quadTo(5, 10, 10, 0).build();
    expect(carried(quad, (set) => translateAnchorBy(set, 0, 1, 1))).toEqual([0, 1, 1, 2]);
  });

  it('gives an anchor the edit drew past an end the end\'s points', () => {
    const line = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    expect(carried(line, (set) => { set.anchors[0].push({ x: 20, y: 0 }, { x: 30, y: 0 }); })).toEqual([0, 1, 1, 1]);
  });

  it('follows each handle of a subpath an edit turns around and puts back as copies', () => {
    expect(carried(curveThenLine(), (set) => { set.anchors[0] = reverseAnchors(set.anchors[0]); }))
      .toEqual([4, 3, 2, 1, 0]);
  });

  it('follows a closed curve whose last segment ends on its first point', () => {
    const loop = new PathBuilder().moveTo(0, 0).curveTo(10, 0, 10, 10, 0, 10).curveTo(-5, 10, -5, 0, 0, 0).close().build();
    // Points: anchor 0, out 1, in 2, anchor 3, out 4, in 5, the first point again 6.
    expect(carried(loop, (set) => translateAnchorBy(set, 1, 1, 0))).toEqual([0, 1, 2, 3, 4, 5, 0]);
  });
});

describe('remapPointValues', () => {
  it('reads a point with no origin, or one past the array\'s end, as 0', () => {
    expect(remapPointValues([4], [null, { a: 0, b: 0, t: 0 }, { a: 0, b: 3, t: 0.5 }])).toEqual([0, 4, 2]);
  });
});

describe('anchorOriginsOf', () => {
  const origins = (path: PolygonPath, edit: Parameters<typeof editAnchorSetTracked>[1]) => {
    const tracked = editAnchorSetTracked(path, edit)!;
    return anchorOriginsOf(path, tracked.path, tracked.origins);
  };

  it('names the anchor each anchor came from, and the two an inserted one sits between', () => {
    expect(origins(square(), (set) => translateAnchorBy(set, 2, 5, 5)))
      .toEqual([{ a: 0, b: 0, t: 0 }, { a: 1, b: 1, t: 0 }, { a: 2, b: 2, t: 0 }, { a: 3, b: 3, t: 0 }]);
    const [, made] = origins(square(), (set) => { insertAnchorOnSegment(set, { sub: 0, segIdx: 0, t: 0.25 }); });
    expect(made).toEqual({ a: 0, b: 1, t: 0.25 });
  });

  it('marks the anchors of a subpath that now runs the other way, and not those of one turned to start elsewhere', () => {
    expect(origins(square(), (set) => { set.anchors[0] = [set.anchors[0][0], ...reverseAnchors(set.anchors[0].slice(1))]; }))
      .toEqual([0, 3, 2, 1].map((a) => ({ a, b: a, t: 0, reversed: true })));
    expect(origins(square(), (set) => { set.anchors[0] = [...set.anchors[0].slice(2), ...set.anchors[0].slice(0, 2)]; }))
      .toEqual([2, 3, 0, 1].map((a) => ({ a, b: a, t: 0 })));
    expect(origins(curveThenLine(), (set) => { set.anchors[0] = reverseAnchors(set.anchors[0]); }))
      .toEqual([2, 1, 0].map((a) => ({ a, b: a, t: 0, reversed: true })));
  });
});
