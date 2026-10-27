import { describe, expect, it } from 'vitest';
import { pathToAnchors, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { convertSegmentAtAction, convertSegmentsAction } from './convertSegments';

const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} };

/** A square at (100, 100), 40 on a side, open in path edit. */
function setup() {
  let current = polygonFromPoints([{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }]);
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath) => { current = worldPath as PolygonPath; },
  });
  const deps = { editAnchors: dep, view: VIEW } as never;
  return { dep, deps, anchors: () => pathToAnchors(current).anchors[0] };
}

const run = (a: { invoker?: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('convertSegments', () => {
  it('curves the segment between two selected anchors, then straightens it again', () => {
    const t = setup();
    t.dep.setSelectedAnchors([0, 1]);
    run(convertSegmentsAction, t.deps);
    const [a, b] = t.anchors();
    expect(a.outHandle!.x).toBeCloseTo(100 + 40 / 3, 4);
    expect(b.inHandle!.x).toBeCloseTo(140 - 40 / 3, 4);
    run(convertSegmentsAction, t.deps);
    expect(t.anchors()[0].outHandle).toBeUndefined();
  });

  it('needs a selected segment', () => {
    const t = setup();
    t.dep.setSelectedAnchors([0, 2]);
    expect(convertSegmentsAction.enabled!(t.deps)).toBe(ActionDisabledReason.SelectionRequired);
    t.dep.setSelectedAnchors([0, 1]);
    expect(convertSegmentsAction.enabled!(t.deps)).toBe(true);
  });
});

describe('convertSegmentAt', () => {
  it('converts the segment under a Shift+double-click, and nothing off every segment', () => {
    const t = setup();
    expect(convertSegmentAtAction.enabled!(t.deps, { x: 140, y: 120 })).toBe(true);
    expect(convertSegmentAtAction.enabled!(t.deps, { x: 120, y: 120 })).toBe(ActionDisabledReason.NotApplicable);
    run(convertSegmentAtAction, t.deps, { world: { x: 140, y: 120 } });
    const [, b, c] = t.anchors();
    expect(b.outHandle?.y).toBeCloseTo(100 + 40 / 3, 4);
    expect(c.inHandle?.y).toBeCloseTo(140 - 40 / 3, 4);
  });
});
