import { describe, expect, it } from 'vitest';
import type { AnchorSet } from './anchorEdits';
import {
  averageAnchorsAt, closestOpenEnds, joinAnchorsAt, joinSubpathEnds, subpathEndAt,
} from './joinAnchors';

const pt = (x: number, y: number) => ({ x, y });

/** Two open lines: (0,0)→(10,0) and (20,5)→(30,5). Flat 0..3. */
function twoLines(): AnchorSet {
  return { anchors: [[pt(0, 0), pt(10, 0)], [pt(20, 5), pt(30, 5)]], closed: [false, false] };
}

describe('averageAnchorsAt', () => {
  it('stacks the anchors on their mean, handles carried along', () => {
    const set: AnchorSet = {
      anchors: [[pt(0, 0), { x: 10, y: 20, inHandle: pt(8, 20) }, pt(20, 40)]],
      closed: [false],
    };
    expect(averageAnchorsAt(set, [0, 1])).toBe(true);
    expect(set.anchors[0][0]).toEqual(pt(5, 10));
    expect(set.anchors[0][1]).toEqual({ x: 5, y: 10, inHandle: pt(3, 10) });
    expect(set.anchors[0][2]).toEqual(pt(20, 40));
  });

  it('averages one coordinate only along an axis', () => {
    const set = twoLines();
    averageAnchorsAt(set, [0, 3], 'x');
    expect(set.anchors[0][0]).toEqual(pt(15, 0));
    expect(set.anchors[1][1]).toEqual(pt(15, 5));
    const other = twoLines();
    averageAnchorsAt(other, [0, 3], 'y');
    expect(other.anchors[0][0]).toEqual(pt(0, 2.5));
    expect(other.anchors[1][1]).toEqual(pt(30, 2.5));
  });

  it('refuses fewer than two anchors', () => {
    const set = twoLines();
    expect(averageAnchorsAt(set, [1])).toBe(false);
    expect(averageAnchorsAt(set, [1, 99])).toBe(false);
    expect(set).toEqual(twoLines());
  });
});

describe('subpathEndAt', () => {
  it('names open ends and nothing else', () => {
    const set: AnchorSet = { anchors: [[pt(0, 0), pt(1, 0), pt(2, 0)], [pt(0, 5), pt(1, 5)]], closed: [false, true] };
    expect(subpathEndAt(set, 0)).toEqual({ sub: 0, end: 'first' });
    expect(subpathEndAt(set, 1)).toBeNull();
    expect(subpathEndAt(set, 2)).toEqual({ sub: 0, end: 'last' });
    expect(subpathEndAt(set, 3)).toBeNull();
  });
});

describe('joinAnchorsAt', () => {
  it('closes a subpath joined to itself', () => {
    const set: AnchorSet = { anchors: [[pt(0, 0), pt(10, 0), pt(10, 10)]], closed: [false] };
    expect(joinAnchorsAt(set, 2, 0)).toBe(true);
    expect(set.closed).toEqual([true]);
    expect(set.anchors[0]).toHaveLength(3);
  });

  it('merges coincident ends when closing, keeping the closing curve', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0, outHandle: pt(5, -5) }, pt(10, 0), { x: 0, y: 0, inHandle: pt(-5, -5) }]],
      closed: [false],
    };
    expect(joinAnchorsAt(set, 0, 2)).toBe(true);
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0, outHandle: pt(5, -5), inHandle: pt(-5, -5) }, pt(10, 0)]);
  });

  it('bridges two subpaths with a straight segment, end to start', () => {
    const set = twoLines();
    expect(joinAnchorsAt(set, 1, 2)).toBe(true);
    expect(set.anchors).toEqual([[pt(0, 0), pt(10, 0), pt(20, 5), pt(30, 5)]]);
    expect(set.closed).toEqual([false]);
  });

  it('turns either subpath around so the joined ends meet', () => {
    const set = twoLines();
    expect(joinAnchorsAt(set, 0, 3)).toBe(true);
    expect(set.anchors).toEqual([[pt(10, 0), pt(0, 0), pt(30, 5), pt(20, 5)]]);
  });

  it('swaps handles when it turns a subpath around', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0, outHandle: pt(3, 3) }, { x: 10, y: 0, inHandle: pt(7, 3) }], [pt(20, 0), pt(30, 0)]],
      closed: [false, false],
    };
    joinAnchorsAt(set, 0, 2);
    expect(set.anchors[0][0]).toEqual({ x: 10, y: 0, outHandle: pt(7, 3) });
    expect(set.anchors[0][1]).toEqual({ x: 0, y: 0, inHandle: pt(3, 3) });
  });

  it('merges coincident ends of two subpaths into one anchor', () => {
    const set: AnchorSet = {
      anchors: [[pt(0, 0), { x: 10, y: 0, inHandle: pt(8, 2) }], [{ x: 10, y: 0, outHandle: pt(12, 2) }, pt(20, 0)]],
      closed: [false, false],
    };
    expect(joinAnchorsAt(set, 1, 2)).toBe(true);
    expect(set.anchors).toEqual([[pt(0, 0), { x: 10, y: 0, inHandle: pt(8, 2), outHandle: pt(12, 2) }, pt(20, 0)]]);
  });

  it('refuses interior anchors, closed subpaths, and one anchor twice', () => {
    const set: AnchorSet = { anchors: [[pt(0, 0), pt(1, 0), pt(2, 0)], [pt(0, 5), pt(1, 5)]], closed: [false, true] };
    expect(joinAnchorsAt(set, 0, 1)).toBe(false);
    expect(joinAnchorsAt(set, 0, 3)).toBe(false);
    expect(joinAnchorsAt(set, 0, 0)).toBe(false);
    expect(joinSubpathEnds(set, { sub: 0, end: 'first' }, { sub: 0, end: 'first' })).toBe(false);
  });
});

describe('closestOpenEnds', () => {
  it('finds the nearest pair of ends on different subpaths', () => {
    expect(closestOpenEnds(twoLines())).toEqual([{ sub: 0, end: 'last' }, { sub: 1, end: 'first' }]);
  });

  it('honors the filter and answers null with one open subpath', () => {
    const near = closestOpenEnds(twoLines(), (a, b) => a.end === 'first' && b.end === 'first');
    expect(near).toEqual([{ sub: 0, end: 'first' }, { sub: 1, end: 'first' }]);
    expect(closestOpenEnds({ anchors: [[pt(0, 0), pt(1, 0)]], closed: [false] })).toBeNull();
  });
});

describe('joinSubpathEnds with a tension', () => {
  it('bridges two paths with a curve leaving each end along its own heading', () => {
    const set = twoLines();
    expect(joinSubpathEnds(set, { sub: 0, end: 'last' }, { sub: 1, end: 'first' }, { tension: 0.5 })).toBe(true);
    const gap = Math.hypot(10, 5);
    expect(set.anchors).toHaveLength(1);
    const [, tail, head] = set.anchors[0];
    expect(tail.outHandle!.x).toBeCloseTo(10 + gap / 2, 9);
    expect(tail.outHandle!.y).toBeCloseTo(0, 9);
    expect(head.inHandle!.x).toBeCloseTo(20 - gap / 2, 9);
    expect(head.inHandle!.y).toBeCloseTo(5, 9);
  });

  it('follows a curved end along its last handle, and an end picked up backwards along its reversed run', () => {
    const set: AnchorSet = {
      anchors: [[pt(0, 0), { x: 10, y: 0, inHandle: pt(10, -4) }], [pt(20, 5), pt(30, 5)]],
      closed: [false, false],
    };
    joinSubpathEnds(set, { sub: 0, end: 'last' }, { sub: 1, end: 'last' }, { tension: 1 });
    const run = set.anchors[0];
    // Heading straight down out of (10, 0); arriving at (30, 5) heading left, as the reversed line runs.
    expect(run[1].outHandle!.x).toBeCloseTo(10, 9);
    expect(run[1].outHandle!.y).toBeGreaterThan(0);
    expect(run[2]).toMatchObject({ x: 30, y: 5 });
    expect(run[2].inHandle!.x).toBeGreaterThan(30);
    expect(run[2].inHandle!.y).toBeCloseTo(5, 9);
  });

  it('closes one path with a curve, and with no tension bridges straight', () => {
    const arc: AnchorSet = { anchors: [[pt(0, 0), pt(10, 10), pt(20, 0)]], closed: [false] };
    joinSubpathEnds(arc, { sub: 0, end: 'last' }, { sub: 0, end: 'first' }, { tension: 0.4 });
    expect(arc.closed).toEqual([true]);
    expect(arc.anchors[0][2].outHandle).toBeDefined();
    expect(arc.anchors[0][0].inHandle).toBeDefined();
    const flat = twoLines();
    joinSubpathEnds(flat, { sub: 0, end: 'last' }, { sub: 1, end: 'first' }, { tension: 0 });
    expect(flat.anchors[0].every((a) => !a.inHandle && !a.outHandle)).toBe(true);
  });
});
