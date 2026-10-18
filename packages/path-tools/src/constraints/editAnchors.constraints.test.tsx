import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  PathBuilder, pathAnchorPoints, pathToAnchors, polygonFromPoints, type PathConstraint, type PolygonPath,
} from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import {
  createScene, defaultCommitAdapter, deleteAnchorsAction, editAnchorsAction, nudgeAnchorsUpAction, selectAnchorAction,
  type EditAnchorsDep, type NodeId, type PathEditMark, type Scene, type SelectionApi,
} from '@weasel-js/core';
import {
  useEditAnchorsDepSourceForTests as useEditAnchorsDepSource, type EditAnchorsStateRef,
} from '@weasel-js/core/test-seams';
import { constrainAnchorsAction, deleteConstraintAction, unconstrainAnchorsAction } from './anchorConstraints';
import { createConstraintsExtension, selectedConstraintOf, setConstraints } from './constraintsExtension';
import { constraintConflictsOf } from './pathConstraints';

type Data = { constraints?: PathConstraint[] };

const PARALLELOGRAM: PathConstraint[] = [
  { kind: 'parallel', segments: [[0, 1], [3, 2]] },
  { kind: 'parallel', segments: [[1, 2], [0, 3]] },
];

const cross = (p: { x: number; y: number }[], [a, b]: number[], [c, d]: number[]) =>
  (p[b].x - p[a].x) * (p[d].y - p[c].y) - (p[b].y - p[a].y) * (p[d].x - p[c].x);

const SQUARE = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]) as PolygonPath;

/** `pose`, a 100-unit square at the origin by default, as a polygon pose in edit mode, carrying `constraints`. */
function setup(constraints: PathConstraint[] = PARALLELOGRAM, pose: PolygonPath = SQUARE) {
  const scene = createScene<Data, 'main', PolygonPath>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'leaf', layer: 'main',
    pose,
    data: { constraints },
  });
  let selected: ReadonlySet<number> = new Set();
  let selectedMark: PathEditMark | null = null;
  const extensions = [createConstraintsExtension()];
  const state: EditAnchorsStateRef = {
    getEditingId: () => id,
    setEditingId: () => {},
    getSelectedAnchors: () => selected,
    setSelectedAnchors: (next) => { selected = next; },
    getMarquee: () => null,
    setMarquee: () => {},
    getSelectedMark: () => selectedMark,
    setSelectedMark: (next) => { selectedMark = next; },
    getExtensions: () => extensions,
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
  const ctx = (x: number, y: number, anchor: number | string, alt = false): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt, ctrl: false, meta: false, shift: false },
    deps: deps(),
    drag: {
      start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 },
      affordance: { kind: typeof anchor === 'number' ? `anchor:${anchor}` : anchor },
    },
  });
  /** Press the handle `part` (`controlOut:1`, say) at `from`, drag it to `to` with Alt held, and release. */
  const dragHandle = (part: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const handle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx(from.x, from.y, part, true), undefined);
    handle.onMove!(ctx(to.x, to.y, part, true));
    const preview = handle.previewPose!(id) as PolygonPath;
    handle.onEnd!(ctx(to.x, to.y, part, true), 'commit');
    return preview;
  };
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
    scene, id, run, drag, dragHandle, points, dep, deps,
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

  it('turns the far handle of a tangent anchor through a handle drag that breaks the mirror', () => {
    const wave = new PathBuilder().moveTo(0, 0).curveTo(20, -20, 60, -20, 80, 0).curveTo(100, 20, 140, 20, 160, 0)
      .build() as PolygonPath;
    const t = setup([{ kind: 'tangent', anchor: 1 }], wave);
    const preview = t.dragHandle('controlOut:1', { x: 100, y: 20 }, { x: 100, y: 40 });
    const [, a] = pathToAnchors(t.scene.get(t.id)!.pose).anchors[0];
    expect(pathToAnchors(preview).anchors[0][1]).toEqual(a);
    expect(a.outHandle).toEqual({ x: 100, y: 40 });
    // The in handle points away from the out handle along one line through the anchor.
    const p = { x: a.inHandle!.x - a.x, y: a.inHandle!.y - a.y };
    expect(Math.abs(p.x * 40 - p.y * 20) / Math.hypot(p.x, p.y)).toBeLessThan(1e-3);
    expect(p.x).toBeLessThan(0);
  });

  it('slides an anchor held on a segment along it under a drag, the segment staying put', () => {
    const tab = polygonFromPoints([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 40, y: 0 },
    ]) as PolygonPath;
    const t = setup([{ kind: 'onPath', anchor: 4, segment: [0, 1] }], tab);
    const preview = t.drag(4, 20, 25);
    const p = t.points();
    expect(p).toEqual(preview);
    expect(p[4].x).toBeCloseTo(60, 1);
    expect(Math.abs(p[4].y)).toBeLessThan(0.1);
    expect(Math.abs(p[0].y) + Math.abs(p[1].y)).toBeLessThan(0.1);
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
    setConstraints(t.dep(), [...held, { kind: 'vertical', segment: [0, 1] }], 'Constrain');
    expect(constraintConflictsOf(t.scene.get(t.id))).toEqual([3]);
    expect(t.points()).toEqual(before);
    expect(t.constraints()).toHaveLength(4);
    // The conflict sits out of later edits instead of stopping them or dragging the rest out of true.
    t.drag(2, 0, 30);
    const p = t.points();
    expect(p[2]).toEqual({ x: 100, y: 130 });
    expect(p[3].y).toBeCloseTo(130, 3);
  });

  it('answers every member of a conflict, not only the constraint left failing', () => {
    const quad = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 30 }, { x: 110, y: 100 }, { x: -10, y: 100 }]) as PolygonPath;
    const held: PathConstraint[] = [
      { kind: 'fixed', anchor: 0 },
      { kind: 'fixed', anchor: 1 },
      { kind: 'horizontal', segment: [2, 3] },
    ];
    const t = setup(held, quad);
    expect(setConstraints(t.dep(), [...held, { kind: 'vertical', segment: [0, 1] }], 'Constrain')).toEqual([0, 1, 3]);
    expect(constraintConflictsOf(t.scene.get(t.id))).toEqual([0, 1, 3]);
    expect(setConstraints(t.dep(), held, 'Unconstrain')).toEqual([]);
  });

  it('reports vertical on a horizontal edge as a conflict instead of collapsing the edge', () => {
    const t = setup([{ kind: 'horizontal', segment: [0, 1] }]);
    const before = t.points();
    t.select(0, 1);
    t.run(constrainAnchorsAction, { kind: 'vertical' });
    expect(t.points()).toEqual(before);
    expect(constraintConflictsOf(t.scene.get(t.id))).toEqual([1]);
  });

  it('selects a constraint by clicking its mark, and deletes just that one', () => {
    const t = setup([{ kind: 'horizontal', segment: [0, 1] }, { kind: 'vertical', segment: [1, 2] }]);
    t.select(2);
    // The bottom edge's mark sits 12 inside its midpoint, toward the square's center.
    t.run(selectAnchorAction, { worldX: 50, worldY: 12 });
    expect(selectedConstraintOf(t.dep())).toBe(0);
    expect(t.dep().selectedAnchors.size).toBe(0);
    // Delete and Backspace are bound once, to deleteAnchors, which deletes the selected constraint.
    expect(deleteAnchorsAction.enabled!(t.deps())).toBe(true);
    expect(deleteConstraintAction.enabled!(t.deps())).toBe(true);
    t.run(deleteAnchorsAction);
    expect(t.constraints()).toEqual([{ kind: 'vertical', segment: [1, 2] }]);
    expect(selectedConstraintOf(t.dep())).toBeNull();
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
