import { describe, expect, it } from 'vitest';
import { PathBuilder, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { averageAnchorsAction, bridgeAnchorsAction, joinAnchorsAction } from './anchorJoin';

/** Two open lines in one path: (0,0)→(10,0) and (20,10)→(30,10). Flat 0..3. */
function twoLines(): PolygonPath {
  return new PathBuilder().moveTo(0, 0).lineTo(10, 0).moveTo(20, 10).lineTo(30, 10).build();
}

function setup(path: PolygonPath, selected: number[]) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = path;
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  dep.setSelectedAnchors(selected);
  return { deps: { editAnchors: dep } as never, dep, commits };
}

const run = (a: { invoker?: unknown }, deps: never, params?: Record<string, unknown>) =>
  (a.invoker as ImmediateInvoker).run(deps, params);

describe('averageAnchorsAction', () => {
  it('stacks the selected anchors on their mean in one commit', () => {
    const { deps, commits } = setup(twoLines(), [1, 2]);
    run(averageAnchorsAction, deps, { axis: 'both' });
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Average anchors');
    const [a, b] = pathToAnchors(commits[0].path).anchors;
    expect([a[1].x, a[1].y]).toEqual([15, 5]);
    expect([b[0].x, b[0].y]).toEqual([15, 5]);
  });

  it('lines the anchors up along one axis per variant', () => {
    const { deps, commits } = setup(twoLines(), [1, 2]);
    run(averageAnchorsAction, deps, { axis: 'y' });
    const [a, b] = pathToAnchors(commits[0].path).anchors;
    expect([a[1].x, a[1].y]).toEqual([10, 5]);
    expect([b[0].x, b[0].y]).toEqual([20, 5]);
    expect(averageAnchorsAction.variants!.map((v) => v.params.axis)).toEqual(['both', 'x', 'y']);
  });

  it('needs two selected anchors', () => {
    const { deps, commits } = setup(twoLines(), [1]);
    expect(averageAnchorsAction.enabled!(deps)).toBe(ActionDisabledReason.SelectionRequired);
    run(averageAnchorsAction, deps);
    expect(commits).toHaveLength(0);
  });
});

describe('joinAnchorsAction', () => {
  it('joins two subpaths at the selected ends and clears the anchor selection', () => {
    const { deps, dep, commits } = setup(twoLines(), [1, 2]);
    expect(joinAnchorsAction.enabled!(deps)).toBe(true);
    run(joinAnchorsAction, deps);
    expect(commits).toHaveLength(1);
    const { anchors, closed } = pathToAnchors(commits[0].path);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].map((a) => [a.x, a.y])).toEqual([[0, 0], [10, 0], [20, 10], [30, 10]]);
    expect(closed).toEqual([false]);
    expect(dep.selectedAnchors.size).toBe(0);
  });

  it('closes a subpath whose two ends are selected', () => {
    const open = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    const { deps, commits } = setup(open, [0, 2]);
    run(joinAnchorsAction, deps);
    expect(pathToAnchors(commits[0].path).closed).toEqual([true]);
  });

  it('is not applicable to an interior anchor, and needs exactly two', () => {
    const open = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    expect(joinAnchorsAction.enabled!(setup(open, [0, 1]).deps)).toBe(ActionDisabledReason.NotApplicable);
    expect(joinAnchorsAction.enabled!(setup(open, [0]).deps)).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('bridgeAnchorsAction', () => {
  it('bridges the selected ends with a curve of the tension asked for, in one commit', () => {
    const { deps, dep, commits } = setup(twoLines(), [1, 2]);
    expect(bridgeAnchorsAction.enabled!(deps)).toBe(true);
    run(bridgeAnchorsAction, deps, { tension: 0.25 });
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Bridge anchors');
    const [joined] = pathToAnchors(commits[0].path).anchors;
    const gap = Math.hypot(10, 10);
    expect(joined[1].outHandle!.x).toBeCloseTo(10 + gap / 4, 4);
    expect(joined[2].inHandle!.x).toBeCloseTo(20 - gap / 4, 4);
    expect(dep.selectedAnchors.size).toBe(0);
  });
});
