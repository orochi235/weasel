import { describe, expect, it } from 'vitest';
import { anchorRulesFor, pressOnCurve, withAnchorMoved, withEmptyInsert } from './functionAnchorEdits';
import type { FunctionLayerState } from './functionLayerTypes';

const state = (xs: number[]): FunctionLayerState => ({ points: xs.map((x) => ({ x, y: 0.5 })), activeIndex: null });
const inverted = { xMin: 1, xMax: 0, yMin: 0, yMax: 1 };

describe('ordered anchors on an inverted x range', () => {
  const rules = anchorRulesFor({ constrain: 'function' });

  it('moves the first anchor between the range edge and its neighbor', () => {
    const next = withAnchorMoved(state([0.2, 0.5, 0.8]), 0, { x: 0.3, y: 0.5 }, inverted, rules);
    expect(next.points[0].x).toBeCloseTo(0.3);
  });

  it('keeps a sliver of x between a dragged anchor and its neighbor', () => {
    const next = withAnchorMoved(state([0.2, 0.5, 0.8]), 1, { x: 0.9, y: 0.5 }, inverted, rules);
    expect(next.points[1].x).toBeLessThan(0.8);
  });

  it('pins pinned-x endpoints to the low and high ends of x', () => {
    const pinned = anchorRulesFor({ constrain: 'function', endpoints: 'pinned-x' });
    expect(withAnchorMoved(state([0, 0.5, 1]), 0, { x: 0.4, y: 0.5 }, inverted, pinned).points[0].x).toBe(0);
    expect(withAnchorMoved(state([0, 0.5, 1]), 2, { x: 0.4, y: 0.5 }, inverted, pinned).points[2].x).toBe(1);
  });

  it('drags the neighbor a press right beside it would crowd', () => {
    const { index, next } = pressOnCurve(state([0.2, 0.5, 0.8]), 0, { x: 0.5001, y: 0.5 }, inverted, rules);
    expect(index).toBe(1);
    expect(next.points).toHaveLength(3);
  });
});

describe('an anchor added to a layer with an xClamp', () => {
  const range = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const rules = anchorRulesFor({ xClamp: [0, 0.3] });

  it('lands inside the clamp when added by a click in empty space', () => {
    const next = withEmptyInsert(state([0, 0.3]), { x: 0.8, y: 0.5 }, range, rules);
    expect(next?.points.map((p) => p.x)).toEqual([0, 0.3, 0.3]);
  });

  it('lands inside the clamp when added by a press on the curve', () => {
    const { next } = pressOnCurve(state([0, 1]), 0, { x: 0.8, y: 0.5 }, range, rules);
    expect(next.points[1].x).toBe(0.3);
  });
});
