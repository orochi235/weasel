import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { pathToAnchors } from './anchors';
import { cubicPointAt } from './cubicMath';
import { convertSegments, isSegmentStraight, segmentsBetweenAnchors } from './segmentType';

const tri = () => new PathBuilder().moveTo(0, 0).lineTo(30, 0).lineTo(30, 30).close().build();

describe('segmentsBetweenAnchors', () => {
  it('names the segments whose two ends are selected, the closing one included', () => {
    const set = pathToAnchors(tri());
    expect(segmentsBetweenAnchors(set, [0, 1])).toEqual([{ sub: 0, segIdx: 0 }]);
    expect(segmentsBetweenAnchors(set, [2, 0])).toEqual([{ sub: 0, segIdx: 2 }]);
    expect(segmentsBetweenAnchors(set, [1])).toEqual([]);
    expect(segmentsBetweenAnchors(set, [0, 1, 2])).toHaveLength(3);
  });

  it('has no closing segment on an open subpath', () => {
    const set = pathToAnchors(new PathBuilder().moveTo(0, 0).lineTo(30, 0).lineTo(30, 30).build());
    expect(segmentsBetweenAnchors(set, [0, 2])).toEqual([]);
  });
});

describe('convertSegments', () => {
  it('curves a line with handles at its thirds, drawing the same line', () => {
    const set = pathToAnchors(tri());
    expect(convertSegments(set, [{ sub: 0, segIdx: 0 }], 'curve')).toBe(true);
    expect(set.anchors[0][0].outHandle).toEqual({ x: 10, y: 0 });
    expect(set.anchors[0][1].inHandle).toEqual({ x: 20, y: 0 });
    expect(isSegmentStraight(set, { sub: 0, segIdx: 0 })).toBe(false);
    const [a, b] = set.anchors[0];
    // Evenly spaced handles also keep the line's speed: t lands at t of the way along.
    for (const t of [0.25, 0.5, 0.75]) expect(cubicPointAt(a, a.outHandle!, b.inHandle!, b, t)).toEqual({ x: 30 * t, y: 0 });
  });

  it('straightens a curve by dropping its own two handles only', () => {
    const p = new PathBuilder().moveTo(0, 0).curveTo(5, -5, 25, -5, 30, 0).curveTo(35, 5, 35, 25, 30, 30).build();
    const set = pathToAnchors(p);
    expect(convertSegments(set, [{ sub: 0, segIdx: 0 }], 'line')).toBe(true);
    expect(set.anchors[0][0].outHandle).toBeUndefined();
    expect(set.anchors[0][1].inHandle).toBeUndefined();
    expect(set.anchors[0][1].outHandle).toEqual({ x: 35, y: 5 });
  });

  it('toggles: curves all when any is straight, straightens all when none is', () => {
    const set = pathToAnchors(tri());
    const segs = [{ sub: 0, segIdx: 0 }, { sub: 0, segIdx: 1 }];
    convertSegments(set, [segs[0]], 'curve');
    expect(convertSegments(set, segs)).toBe(true);
    expect(segs.map((s) => isSegmentStraight(set, s))).toEqual([false, false]);
    expect(convertSegments(set, segs)).toBe(true);
    expect(segs.map((s) => isSegmentStraight(set, s))).toEqual([true, true]);
    expect(convertSegments(set, segs, 'line')).toBe(false);
  });
});
