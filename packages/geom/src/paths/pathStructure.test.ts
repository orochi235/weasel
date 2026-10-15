import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { pathToAnchors, type PenAnchor } from './anchors';
import { editAnchorSetTracked, remapAnchorValues } from './anchorOrigins';
import type { AnchorSet } from './anchorEdits';
import {
  directionMarks, flatIndexesAfterReverse, reverseSubpaths, setSubpathStart, subpathsOfAnchors,
} from './pathStructure';

const square = () => new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
const open = () => new PathBuilder().moveTo(0, 0).lineTo(10, 0).curveTo(15, 0, 20, 5, 20, 10).build();
const pts = (set: AnchorSet, s = 0) => set.anchors[s].map((a) => [a.x, a.y]);

describe('setSubpathStart', () => {
  it('turns a closed subpath to start at the anchor, keeping its direction', () => {
    const set = pathToAnchors(square());
    expect(setSubpathStart(set, 2)).toBe(true);
    expect(pts(set)).toEqual([[10, 10], [0, 10], [0, 0], [10, 0]]);
    expect(set.closed).toEqual([true]);
  });

  it('reverses an open subpath to start at its last anchor, and refuses an interior one', () => {
    const set = pathToAnchors(open());
    expect(setSubpathStart(set, 1)).toBe(false);
    expect(setSubpathStart(set, 0)).toBe(false);
    expect(setSubpathStart(set, 2)).toBe(true);
    expect(pts(set)).toEqual([[20, 10], [10, 0], [0, 0]]);
    expect(set.anchors[0][0].outHandle).toEqual({ x: 20, y: 5 });
  });

  it('carries whatever else an anchor holds', () => {
    const set = pathToAnchors(square());
    (set.anchors[0][3] as PenAnchor & { tag?: string }).tag = 'corner';
    setSubpathStart(set, 3);
    expect((set.anchors[0][0] as PenAnchor & { tag?: string }).tag).toBe('corner');
  });
});

describe('reverseSubpaths', () => {
  it('runs a closed subpath backward from the same start, and an open one from its end', () => {
    const b = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close();
    const set = pathToAnchors(b.moveTo(50, 0).lineTo(60, 0).lineTo(70, 5).build());
    expect(reverseSubpaths(set)).toBe(true);
    expect(pts(set, 0)).toEqual([[0, 0], [0, 10], [10, 10], [10, 0]]);
    expect(pts(set, 1)).toEqual([[70, 5], [60, 0], [50, 0]]);
  });

  it('turns only the subpaths named, swapping handles so the curve keeps its shape', () => {
    const b = new PathBuilder().moveTo(0, 0).lineTo(10, 0).close().moveTo(0, 0).lineTo(10, 0).curveTo(15, 0, 20, 5, 20, 10);
    const set = pathToAnchors(b.build());
    reverseSubpaths(set, [1]);
    expect(pts(set, 0)).toEqual([[0, 0], [10, 0]]);
    expect(set.anchors[1][0]).toEqual({ x: 20, y: 10, outHandle: { x: 20, y: 5 } });
    expect(set.anchors[1][1]).toEqual({ x: 10, y: 0, inHandle: { x: 15, y: 0 } });
  });

  it('follows the selection to where its anchors moved', () => {
    const b = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close();
    const set = pathToAnchors(b.moveTo(50, 0).lineTo(60, 0).lineTo(70, 5).build());
    expect(flatIndexesAfterReverse(set, [0, 1, 4, 5])).toEqual([0, 3, 6, 5]);
    expect(flatIndexesAfterReverse(set, [1, 4], [1])).toEqual([1, 6]);
    expect(subpathsOfAnchors(set, [5, 1, 2])).toEqual([0, 1]);
  });

  it('keeps per-anchor colors on the anchors they belong to', () => {
    const path = open();
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const next = editAnchorSetTracked(path, (set) => reverseSubpaths(set))!;
    expect(remapAnchorValues(colors, 4, path, next.path, next.origins)).toEqual([0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1]);
  });
});

describe('directionMarks', () => {
  it('heads along each segment from its middle, the closing one included', () => {
    const marks = directionMarks(pathToAnchors(square()));
    expect(marks.map((m) => [m.x, m.y, m.dx, m.dy])).toEqual([
      [5, 0, 1, 0], [10, 5, 0, 1], [5, 10, -1, 0], [0, 5, 0, -1],
    ]);
  });

  it('takes a curve’s heading at its middle', () => {
    const [, mark] = directionMarks(pathToAnchors(open()));
    expect(mark.x).toBeCloseTo(16.875);
    expect(mark.y).toBeCloseTo(3.125);
    expect(mark.dx).toBeCloseTo(Math.SQRT1_2);
    expect(mark.dy).toBeCloseTo(Math.SQRT1_2);
  });
});
