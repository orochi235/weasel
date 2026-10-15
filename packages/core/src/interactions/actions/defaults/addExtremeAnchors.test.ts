import { describe, expect, it } from 'vitest';
import { pathFromD, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { addExtremeAnchorsAction } from './addExtremeAnchors';

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

const run = (deps: ActionDeps, params: Record<string, unknown>) =>
  (addExtremeAnchorsAction.invoker as ImmediateInvoker).run(deps, params);

describe('addExtremeAnchorsAction', () => {
  it('adds the extremes of the whole path in one commit', () => {
    const { deps, labels, anchors } = setup([]);
    run(deps, { scope: 'path' });
    expect(labels).toEqual(['Add extremes']);
    expect(anchors().map((a) => [a.x, a.y])).toEqual([[0, 0], [50, -60], [100, 0], [150, -60], [200, 0], [260, 0]]);
  });

  it('adds only to segments with both ends selected, and keeps the selection on the same anchors', () => {
    const { dep, deps, anchors } = setup([1, 2]);
    run(deps, { scope: 'selection' });
    expect(anchors()).toHaveLength(5);
    expect([anchors()[2].x, anchors()[2].y]).toEqual([150, -60]);
    // (100,0) and (200,0) are now flat 1 and 3, the new extreme 2.
    expect([...dep.selectedAnchors].sort()).toEqual([1, 2, 3]);
  });

  it('commits nothing when the selection spans no curve, and is disabled once every extreme has an anchor', () => {
    const { deps, labels } = setup([2, 3]);
    run(deps, { scope: 'selection' });
    expect(labels).toEqual([]);
    expect(addExtremeAnchorsAction.enabled!(deps)).toBe(true);
    run(deps, { scope: 'path' });
    expect(addExtremeAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});
