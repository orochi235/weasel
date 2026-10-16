import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { pathAnchorPoints, polygonFromPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { deleteAnchorsAction, nudgeAnchorsUpAction, selectAnchorAction } from 'interactions/actions/defaults/anchorEditing';
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from 'interactions/actions/defaults/anchorConstraints';
import { editAnchorsAction } from 'interactions/actions/edit-anchors/action';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from './editAnchors';

type Data = { constraints?: PathConstraint[] };

const PARALLELOGRAM: PathConstraint[] = [
  { kind: 'parallel', segments: [[0, 1], [3, 2]] },
  { kind: 'parallel', segments: [[1, 2], [0, 3]] },
];

const cross = (p: { x: number; y: number }[], [a, b]: number[], [c, d]: number[]) =>
  (p[b].x - p[a].x) * (p[d].y - p[c].y) - (p[b].y - p[a].y) * (p[d].x - p[c].x);

/** A 100-unit square at the origin as a polygon pose, in edit mode, carrying `constraints`. */
function setup(constraints: PathConstraint[] = PARALLELOGRAM) {
  const scene = createScene<Data, 'main', PolygonPath>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'leaf', layer: 'main',
    pose: polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) as PolygonPath,
    data: { constraints },
  });
  let selected: ReadonlySet<number> = new Set();
  let selectedConstraint: number | null = null;
  const state: EditAnchorsStateRef = {
    getEditingId: () => id,
    setEditingId: () => {},
    getSelectedAnchors: () => selected,
    setSelectedAnchors: (next) => { selected = next; },
    getMarquee: () => null,
    setMarquee: () => {},
    getSelectedConstraint: () => selectedConstraint,
    setSelectedConstraint: (next) => { selectedConstraint = next; },
    getHandleLocks: () => null,
    setHandleLocks: () => {},
    getTool: () => null,
    setTool: () => {},
  };
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const adapter = {
    applyOps: (ops: Parameters<typeof scene.applyBatch>[0], label = '') => {
      scene.applyBatch(ops, label, defaultCommitAdapter(loose));
    },
  };
  const selection = { current: [id] as NodeId[] } as unknown as SelectionApi;
  const { result } = renderHook(() => {
    useEditAnchorsDepSource(loose, selection, adapter, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const dep = () => (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
  const deps = () => ({ editAnchors: dep(), selection: { get: () => [id] } }) as unknown as ActionDeps;
  const run = (action: { invoker?: unknown }, params?: Record<string, unknown>) =>
    (action.invoker as ImmediateInvoker).run(deps(), params);
  const points = () => pathAnchorPoints(scene.get(id)!.pose);
  const ctx = (x: number, y: number, anchor: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: deps(),
    drag: { start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 }, affordance: { kind: `anchor:${anchor}` } },
  });
  /** Press anchor `anchor` where it is, move it by `(dx, dy)`, and release. */
  const drag = (anchor: number, dx: number, dy: number) => {
    const p = points()[anchor];
    const handle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx(p.x, p.y, anchor), undefined);
    handle.onMove!(ctx(p.x + dx, p.y + dy, anchor));
    const preview = handle.previewPose!(id) as PolygonPath;
    handle.onEnd!(ctx(p.x + dx, p.y + dy, anchor), 'commit');
    return pathAnchorPoints(preview);
  };
  return {
    scene, id, run, drag, points, dep, deps,
    select: (...flat: number[]) => { selected = new Set(flat); },
    constraints: () => scene.get(id)!.data.constraints ?? [],
  };
}

describe('constrained path edits', () => {
  it('keeps a parallelogram one through an anchor drag, preview and commit alike', () => {
    const t = setup();
    const preview = t.drag(2, 40, 20);
    const after = t.points();
    expect(after).toEqual(preview);
    expect(after[2]).toEqual({ x: 140, y: 120 });
    expect(Math.abs(cross(after, [0, 1], [3, 2]))).toBeLessThan(0.05);
    expect(Math.abs(cross(after, [1, 2], [0, 3]))).toBeLessThan(0.05);
    t.scene.undo();
    expect(t.points()[2]).toEqual({ x: 100, y: 100 });
  });

  it('refuses to move a fixed anchor, by drag or by nudge', () => {
    const t = setup([{ kind: 'fixed', anchor: 1 }]);
    t.drag(1, 30, 30);
    expect(t.points()[1]).toEqual({ x: 100, y: 0 });
    t.select(1);
    t.run(nudgeAnchorsUpAction, { magnitude: 'small' });
    expect(t.points()[1]).toEqual({ x: 100, y: 0 });
  });

  it('renumbers its constraints when an anchor is deleted', () => {
    const t = setup([{ kind: 'horizontal', segment: [2, 3] }, { kind: 'fixed', anchor: 1 }]);
    t.select(1);
    t.run(deleteAnchorsAction);
    expect(t.constraints()).toEqual([{ kind: 'horizontal', segment: [1, 2] }]);
  });
});

describe('constrainAnchors and unconstrainAnchors', () => {
  it('adds a constraint on the selected anchors and moves the path to satisfy it', () => {
    const t = setup([]);
    t.select(0, 2);
    t.run(constrainAnchorsAction, { kind: 'horizontal' });
    expect(t.constraints()).toEqual([{ kind: 'horizontal', segment: [0, 2] }]);
    const p = t.points();
    expect(p[0].y).toBeCloseTo(p[2].y, 3);
    t.scene.undo();
    expect(t.constraints()).toEqual([]);
    expect(t.points()[2]).toEqual({ x: 100, y: 100 });
  });

  it('keeps a conflicting constraint unsolved and reports it, leaving the path as it was', () => {
    const held: PathConstraint[] = [
      { kind: 'fixed', anchor: 0 },
      { kind: 'fixed', anchor: 1 },
      { kind: 'horizontal', segment: [2, 3] },
    ];
    const t = setup(held);
    const before = t.points();
    const unsatisfied = t.dep().setConstraints!(t.id, [...held, { kind: 'vertical', segment: [0, 1] }], 'Constrain');
    expect(unsatisfied).toEqual([3]);
    expect(t.points()).toEqual(before);
    expect(t.constraints()).toHaveLength(4);
    // The conflict sits out of later edits instead of stopping them or dragging the rest out of true.
    t.drag(2, 0, 30);
    const p = t.points();
    expect(p[2]).toEqual({ x: 100, y: 130 });
    expect(p[3].y).toBeCloseTo(130, 3);
  });

  it('reports vertical on a horizontal edge as a conflict instead of collapsing the edge', () => {
    const t = setup([{ kind: 'horizontal', segment: [0, 1] }]);
    const before = t.points();
    t.select(0, 1);
    t.run(constrainAnchorsAction, { kind: 'vertical' });
    expect(t.points()).toEqual(before);
    expect(t.dep().setConstraints!(t.id, t.constraints(), 'Constrain')).toEqual([1]);
  });

  it('selects a constraint by clicking its mark, and deletes just that one', () => {
    const t = setup([{ kind: 'horizontal', segment: [0, 1] }, { kind: 'vertical', segment: [1, 2] }]);
    t.select(2);
    // The bottom edge's mark sits 12 inside its midpoint, toward the square's center.
    t.run(selectAnchorAction, { worldX: 50, worldY: 12 });
    expect(t.dep().selectedConstraint).toBe(0);
    expect(t.dep().selectedAnchors.size).toBe(0);
    expect(deleteAnchorsAction.enabled!(t.deps())).not.toBe(true);
    t.run(deleteConstraintAction);
    expect(t.constraints()).toEqual([{ kind: 'vertical', segment: [1, 2] }]);
    expect(t.dep().selectedConstraint).toBeNull();
    t.scene.undo();
    expect(t.constraints()).toHaveLength(2);
  });

  it('reads three selected anchors as two segments meeting at the middle one', () => {
    const t = setup([]);
    t.select(0, 1, 2);
    t.run(constrainAnchorsAction, { kind: 'perpendicular' });
    expect(t.constraints()).toEqual([{ kind: 'perpendicular', segments: [[0, 1], [1, 2]] }]);
  });

  it('removes the constraints whose anchors are all selected', () => {
    const t = setup([...PARALLELOGRAM, { kind: 'horizontal', segment: [0, 1] }]);
    t.select(0, 1);
    t.run(unconstrainAnchorsAction);
    expect(t.constraints()).toEqual(PARALLELOGRAM);
    t.select(0, 1, 2, 3);
    t.run(unconstrainAnchorsAction, { kind: 'parallel' });
    expect(t.constraints()).toEqual([]);
  });
});
