import { describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import {
  growAnchorSelectionAction, invertAnchorSelectionAction, selectCornerAnchorsAction, selectEveryNthAnchorAction,
  selectSmoothAnchorsAction, shrinkAnchorSelectionAction,
} from './anchorSelect';

/** An open path of six anchors: corner, smooth, smooth, then three corners. */
const PATH = pathFromD('M 0 0 C 10 -10 20 -10 30 0 C 40 10 50 10 60 0 C 70 -10 80 -10 90 0 L 120 0 L 150 30') as PolygonPath;

function setup(selected: number[], editingId = 'p1') {
  let commits = 0;
  const dep = makeEditAnchorsDep({
    editingId,
    getEditablePath: () => PATH,
    applyEdit: () => { commits++; },
  });
  dep.setSelectedAnchors(selected);
  return { dep, deps: { editAnchors: dep } as unknown as ActionDeps, commits: () => commits };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps, params: Record<string, unknown> = {}) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

describe('anchor selection along the path', () => {
  it('grows and shrinks by one anchor, committing nothing', () => {
    const { dep, deps, commits } = setup([2]);
    run(growAnchorSelectionAction, deps);
    expect([...dep.selectedAnchors]).toEqual([1, 2, 3]);
    run(shrinkAnchorSelectionAction, deps);
    expect([...dep.selectedAnchors]).toEqual([2]);
    expect(commits()).toBe(0);
  });

  it('selects every Nth anchor from the first selected one', () => {
    const { dep, deps } = setup([1]);
    run(selectEveryNthAnchorAction, deps, { n: 2 });
    expect([...dep.selectedAnchors]).toEqual([1, 3, 5]);
  });

  it('selects corners, smooth anchors, and the complement', () => {
    const { dep, deps } = setup([]);
    run(selectCornerAnchorsAction, deps);
    expect([...dep.selectedAnchors]).toEqual([0, 3, 4, 5]);
    run(invertAnchorSelectionAction, deps);
    expect([...dep.selectedAnchors]).toEqual([1, 2]);
    run(selectSmoothAnchorsAction, deps);
    expect([...dep.selectedAnchors]).toEqual([1, 2]);
  });

  it('is disabled outside path edit, and grow/shrink without a selection', () => {
    expect(selectCornerAnchorsAction.enabled!(setup([], '').deps)).toBe(ActionDisabledReason.SelectionRequired);
    expect(growAnchorSelectionAction.enabled!(setup([]).deps)).toBe(ActionDisabledReason.SelectionRequired);
    expect(selectCornerAnchorsAction.enabled!(setup([]).deps)).toBe(true);
  });
});
