import { describe, expect, it } from 'vitest';
import { pathToAnchors, polygonFromPoints, type PointOrigin, type PolygonPath } from '@weasel-js/geom';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { reversePathAction, setPathStartAction } from './pathStructure';

const SQUARE = polygonFromPoints([{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }, { x: 100, y: 140 }]);

/** The square, open in path edit as `p1` when `editing`, and selected either way. */
function setup(editing = true) {
  const commits: Array<{ path: PolygonPath; label: string; origins?: readonly (PointOrigin | null)[] }> = [];
  const batches: Array<{ ops: unknown[]; label: string }> = [];
  let current = SQUARE;
  const dep = makeEditAnchorsDep({
    editingId: editing ? 'p1' : '',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label, origins) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label, origins });
    },
    editOps: (id, worldPath, label) => [{ id, worldPath, label }] as never,
  });
  const deps = {
    editAnchors: dep,
    selection: { get: () => ['p1'] },
    applyOps: (ops: unknown[], label: string) => batches.push({ ops, label }),
  } as never;
  const corners = () => pathToAnchors(current).anchors[0].map((a) => [a.x, a.y]);
  return { deps, dep, commits, batches, corners };
}

const run = (a: { invoker?: unknown }, deps: never) => (a.invoker as ImmediateInvoker).run(deps, undefined);

describe('setPathStart', () => {
  it('starts the closed path at the selected anchor, saying where each anchor came from, and keeps it selected', () => {
    const t = setup();
    t.dep.setSelectedAnchors([2]);
    expect(setPathStartAction.enabled!(t.deps)).toBe(true);
    run(setPathStartAction, t.deps);
    expect(t.corners()).toEqual([[140, 140], [100, 140], [100, 100], [140, 100]]);
    expect(t.commits[0].label).toBe('Make start point');
    expect(t.commits[0].origins).toBeDefined();
    expect([...t.dep.selectedAnchors]).toEqual([0]);
  });

  it('is off for an anchor already first, and with more than one selected', () => {
    const t = setup();
    t.dep.setSelectedAnchors([0]);
    expect(setPathStartAction.enabled!(t.deps)).toBe(ActionDisabledReason.NotApplicable);
    t.dep.setSelectedAnchors([1, 2]);
    expect(setPathStartAction.enabled!(t.deps)).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('reversePath', () => {
  it('reverses the edited path from the same start, the selection following its anchor', () => {
    const t = setup();
    t.dep.setSelectedAnchors([1]);
    run(reversePathAction, t.deps);
    expect(t.corners()).toEqual([[100, 100], [100, 140], [140, 140], [140, 100]]);
    expect([...t.dep.selectedAnchors]).toEqual([3]);
  });

  it('reverses every selected path whole outside path edit, in one batch', () => {
    const t = setup(false);
    expect(reversePathAction.enabled!(t.deps)).toBe(true);
    run(reversePathAction, t.deps);
    expect(t.batches).toHaveLength(1);
    expect(t.batches[0].label).toBe('Reverse path direction');
    const [op] = t.batches[0].ops as Array<{ worldPath: PolygonPath }>;
    expect(pathToAnchors(op.worldPath).anchors[0].map((a) => [a.x, a.y]))
      .toEqual([[100, 100], [100, 140], [140, 140], [140, 100]]);
  });
});
