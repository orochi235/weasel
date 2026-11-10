/**
 * Counterexamples `reshape.pbt.test.ts` shrank to, kept as examples. Ruled 2026-11-10: an edit action that
 * would change nothing is disabled with `NotApplicable`; a selection command stays enabled.
 */
import { describe, expect, it } from 'vitest';
import { anchorsToPath, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type Action, type ImmediateInvoker } from '@weasel-js/routing';
import { deleteAnchorsAction, nudgeAnchorsLeftAction } from '@weasel-js/core';
import {
  constrainAnchorsAction, resamplePathAction, reversePathAction, selectSmoothAnchorsAction, setCornersAction,
  unconstrainAnchorsAction,
} from './index';
import { editHarness } from './shared/testing/editHarness';

const TRIANGLE = polygonFromPoints([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 30 }]) as PolygonPath;
const LINE = anchorsToPath([[{ x: 0, y: 0 }, { x: 40, y: 0 }]], [false]);

function check(path: PolygonPath, selected: number[], action: Action, params?: Record<string, unknown>) {
  const h = editHarness(path);
  h.setSelected(selected);
  const enabled = action.enabled!(h.deps(), undefined, undefined, params);
  const before = JSON.stringify(Array.from(h.path().coords));
  const at = h.scene.historyIndex();
  (action.invoker as ImmediateInvoker).run(h.deps(), params);
  const changed = h.scene.historyIndex() > at || JSON.stringify(Array.from(h.path().coords)) !== before;
  h.unmount();
  return { enabled, changed };
}

describe('edit actions that would change nothing are disabled', () => {
  it('deleteAnchors on a two-anchor line, which keeps its two', () => {
    expect(check(LINE, [0], deleteAnchorsAction)).toEqual({ enabled: ActionDisabledReason.NotApplicable, changed: false });
  });

  it('constrainAnchors on one anchor, for a kind that needs two', () => {
    expect(check(TRIANGLE, [0], constrainAnchorsAction, { kind: 'horizontal' }))
      .toEqual({ enabled: ActionDisabledReason.NotApplicable, changed: false });
  });

  it('unconstrainAnchors on a path with no constraints', () => {
    expect(check(TRIANGLE, [0, 1], unconstrainAnchorsAction)).toEqual({ enabled: ActionDisabledReason.NotApplicable, changed: false });
  });

  it('setCorners with nothing to set, or with what the corner already has', () => {
    expect(check(TRIANGLE, [0], setCornersAction)).toEqual({ enabled: ActionDisabledReason.NotApplicable, changed: false });
    const h = editHarness(TRIANGLE);
    h.setSelected([0]);
    expect(setCornersAction.enabled!(h.deps(), undefined, undefined, { radius: 5 })).toBe(true);
    (setCornersAction.invoker as ImmediateInvoker).run(h.deps(), { radius: 5 });
    expect(setCornersAction.enabled!(h.deps(), undefined, undefined, { radius: 5 })).toBe(ActionDisabledReason.NotApplicable);
    h.unmount();
  });

  it('reversePath with a selection naming no anchor of the path', () => {
    const two = anchorsToPath([[{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 20 }, { x: 10, y: 20 }]], [false, true]);
    expect(check(two, [4], reversePathAction)).toEqual({ enabled: ActionDisabledReason.NotApplicable, changed: false });
  });

  it('a nudge whose selection an undo left naming no anchor', () => {
    const h = editHarness(anchorsToPath([[{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }]], [false]));
    (resamplePathAction.invoker as ImmediateInvoker).run(h.deps(), undefined);
    h.setSelected([6]);
    h.scene.undo();
    expect(nudgeAnchorsLeftAction.enabled!(h.deps())).toBe(ActionDisabledReason.NotApplicable);
    h.unmount();
  });
});

describe('selection commands stay enabled', () => {
  it('selectSmoothAnchors on a path with no smooth anchors', () => {
    expect(check(TRIANGLE, [], selectSmoothAnchorsAction).enabled).toBe(true);
  });
});
