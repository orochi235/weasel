import { describe, expect, it } from 'vitest';
import { pathFromD, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ActionDeps, type ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { addExtremeAnchorsAction } from './addExtremes';

/** Two arches, each with one extreme at its top, then a straight tail:
 *  anchors (0,0), (100,0), (200,0), (260,0). */
const ARCHES = 'M 0 0 C 0 -80 100 -80 100 0 C 100 -80 200 -80 200 0 L 260 0';

function setup(selected: number[]) {
  let current = pathFromD(ARCHES) as PolygonPath;
  const labels: string[] = [];
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, path, label) => {
      current = path as PolygonPath;
      labels.push(label);
    },
  });
  dep.setSelectedAnchors(selected);
  return { dep, deps: { editAnchors: dep } as unknown as ActionDeps, labels, anchors: () => pathToAnchors(current).anchors[0] };
}

const run = (deps: ActionDeps, params: Record<string, unknown> = {}) => (addExtremeAnchorsAction.invoker as ImmediateInvoker).run(deps, params);

describe('addExtremeAnchorsAction', () => {
  it('adds the extremes of the whole path in one commit while no anchor is selected', () => {
    const { deps, labels, anchors } = setup([]);
    run(deps);
    expect(labels).toEqual(['Add extremes']);
    expect(anchors().map((a) => [a.x, a.y])).toEqual([[0, 0], [50, -60], [100, 0], [150, -60], [200, 0], [260, 0]]);
  });

  it('adds only to segments with both ends selected, and keeps the selection on the same anchors', () => {
    const { dep, deps, anchors } = setup([1, 2]);
    run(deps);
    expect(anchors()).toHaveLength(5);
    expect([anchors()[2].x, anchors()[2].y]).toEqual([150, -60]);
    // (100,0) and (200,0) are now flat 1 and 3, the new extreme 2.
    expect([...dep.selectedAnchors].sort()).toEqual([1, 2, 3]);
  });

  it('is disabled where it would add nothing: a selection spanning no curve, or every extreme placed', () => {
    const { dep, deps, labels } = setup([2, 3]);
    expect(addExtremeAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
    run(deps);
    expect(labels).toEqual([]);
    dep.setSelectedAnchors([]);
    expect(addExtremeAnchorsAction.enabled!(deps)).toBe(true);
    run(deps);
    expect(addExtremeAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('splits at the turns along the axes its params name', () => {
    // The arches turn only in y, at their tops.
    const inX = setup([]);
    run(inX.deps, { axes: 'x' });
    expect(inX.labels).toEqual([]);
    const inY = setup([]);
    run(inY.deps, { axes: 'y' });
    expect(inY.anchors()).toHaveLength(6);
  });
});
