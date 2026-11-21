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
    const { index, next } = pressOnCurve(state([0.2, 0.5, 0.8]), 0, { x: 0.5001, y: 0.5 }, inverted, rules)!;
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
    const { next } = pressOnCurve(state([0, 1]), 0, { x: 0.8, y: 0.5 }, range, rules)!;
    expect(next.points[1].x).toBe(0.3);
  });
});

describe('a locked anchor', () => {
  const range = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const rules = anchorRulesFor({ constrain: 'function' });
  const locked: FunctionLayerState = { points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5, locked: true }, { x: 1, y: 1 }], activeIndex: null };

  it('is not taken by a press on the curve right beside it', () => {
    expect(pressOnCurve(locked, 0, { x: 0.4999, y: 0.5 }, range, rules)).toBeNull();
  });

  it('holds still when dragged', () => {
    expect(withAnchorMoved(locked, 1, { x: 0.7, y: 0.9 }, range, rules)).toBe(locked);
  });
});

describe('the gap a strict layer with an xClamp keeps', () => {
  const range = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const rules = anchorRulesFor({ constrain: 'function', xClamp: [0, 0.1] });

  it('lets a press on the curve insert as close to a neighbor as a drag may bring an anchor', () => {
    const { index, next } = pressOnCurve(state([0, 0.05, 0.1]), 1, { x: 0.0515, y: 0.5 }, range, rules)!;
    expect(index).toBe(2);
    expect(next.points).toHaveLength(4);
  });
});

describe('an anchor added by a press on an ordered curve', () => {
  const range = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

  it.each(['1d', 'function'] as const)('stays inside its segment\'s x span (%s)', (kind) => {
    const rules = anchorRulesFor(kind === '1d' ? { domain: '1d' } : { constrain: 'function' });
    const { index, next } = pressOnCurve(state([0, 0.5, 0.52, 1]), 1, { x: 0.4875, y: 0.5 }, range, rules)!;
    const xs = next.points.map((p) => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(next.points[index].x).toBeGreaterThanOrEqual(0.5);
  });
});

describe('an anchor added by a click in empty space on a strict layer', () => {
  const range = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const rules = anchorRulesFor({ constrain: 'function' });

  it('keeps off the x of the anchor it was clicked above', () => {
    const next = withEmptyInsert(state([0, 0.5, 1]), { x: 0.5, y: 0.9 }, range, rules)!;
    const xs = next.points.map((p) => p.x);
    expect(xs).toHaveLength(4);
    expect(xs[2]).toBeGreaterThan(0.5);
    expect(xs[2]).toBeLessThan(xs[3]);
  });

  it('is not added past an anchor already at the end of the range', () => {
    expect(withEmptyInsert(state([0, 1]), { x: 1.2, y: 0.9 }, range, rules)).toBeNull();
  });
});
