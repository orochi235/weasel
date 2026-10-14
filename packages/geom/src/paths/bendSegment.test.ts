import { describe, expect, it } from 'vitest';
import { bendSegment } from './bendSegment';
import { cubicPointAt } from './cubicMath';
import { isAnchorSmooth, type PenAnchor } from './anchors';
import type { AnchorSet } from './anchorEdits';

function pointOn(a: PenAnchor, b: PenAnchor, t: number) {
  return cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, t);
}

describe('bendSegment', () => {
  it('carries the held point of a curve exactly along with the drag', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 10, y: 30 } },
        { x: 100, y: 0, inHandle: { x: 80, y: 20 } },
      ]],
      closed: [false],
    };
    const [a, b] = set.anchors[0];
    const before = pointOn(a, b, 0.3);
    expect(bendSegment(set, { sub: 0, segIdx: 0, t: 0.3 }, 7, -12)).toBe(true);
    const after = pointOn(a, b, 0.3);
    expect(after.x).toBeCloseTo(before.x + 7, 9);
    expect(after.y).toBeCloseTo(before.y - 12, 9);
  });

  it('turns a straight segment into a curve through the pointer', () => {
    const set: AnchorSet = { anchors: [[{ x: 0, y: 0 }, { x: 90, y: 0 }]], closed: [false] };
    bendSegment(set, { sub: 0, segIdx: 0, t: 0.5 }, 0, 40);
    const [a, b] = set.anchors[0];
    expect(a.outHandle).toBeDefined();
    expect(b.inHandle).toBeDefined();
    const mid = pointOn(a, b, 0.5);
    expect(mid.x).toBeCloseTo(45, 9);
    expect(mid.y).toBeCloseTo(40, 9);
  });

  it('keeps a smooth end anchor smooth, turning its other handle at its own length', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 20, y: 0 } },
        { x: 50, y: 0, inHandle: { x: 40, y: 0 }, outHandle: { x: 80, y: 0 } },
        { x: 100, y: 0, inHandle: { x: 90, y: 0 } },
      ]],
      closed: [false],
    };
    bendSegment(set, { sub: 0, segIdx: 0, t: 0.5 }, 0, 30);
    const mid = set.anchors[0][1];
    expect(isAnchorSmooth(mid)).toBe(true);
    expect(Math.hypot(mid.outHandle!.x - 50, mid.outHandle!.y)).toBeCloseTo(30, 9);
  });

  it('bends the closing segment of a closed subpath', () => {
    const set: AnchorSet = {
      anchors: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
      closed: [true],
    };
    expect(bendSegment(set, { sub: 0, segIdx: 2, t: 0.5 }, -5, 0)).toBe(true);
    expect(set.anchors[0][2].outHandle).toBeDefined();
    expect(set.anchors[0][0].inHandle).toBeDefined();
  });

  it('reports a segment that does not exist', () => {
    const set: AnchorSet = { anchors: [[{ x: 0, y: 0 }, { x: 10, y: 0 }]], closed: [false] };
    expect(bendSegment(set, { sub: 0, segIdx: 1, t: 0.5 }, 1, 1)).toBe(false);
  });
});
