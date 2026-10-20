import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { pathAnchorPoints, polygonFromPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import {
  createScene, createTransformOp, defaultCommitAdapter, moveAction, pathsPreset, deleteAnchorsAction, editAnchorsAction, findNodeShape,
  type EditAnchorsDep, type NodeId, type Op, type PathEditMark, type Scene, type SelectionApi, type TransformFollower,
} from '@weasel-js/core';
import {
  useEditAnchorsDepSourceForTests as useEditAnchorsDepSource, type EditAnchorsStateRef,
} from '@weasel-js/core/test-seams';
import { constraintLinkConflictsOf, constraintLinkNode, constraintLinkOf } from './constraintLinks';
import { linkAnchorAction } from './linkAnchor';
import { createConstraintsExtension } from './constraintsExtension';

type Data = { constraints?: PathConstraint[]; constraintLink?: PathConstraint };

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;

/**
 * A square, and a triangle whose anchor 0 is held on the square's bottom edge
 * by a link node: in link numbering the triangle's anchors come first, so the
 * square's anchors 0 → 1 are 3 → 4.
 */
function setup() {
  const scene = createScene<Data, 'main' | 'notes', unknown>({ systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }] });
  const square = scene.add({ kind: 'leaf', layer: 'main', pose: poly([0, 0], [100, 0], [100, 100], [0, 100]), data: {} });
  const triangle = scene.add({
    kind: 'leaf', layer: 'main', pose: poly([40, 0], [40, -50], [10, -50]),
    data: { constraints: [{ kind: 'vertical', segment: [0, 1] }] },
  });
  const link = scene.add(constraintLinkNode<unknown>({
    layer: 'notes', nodes: [triangle, square], constraint: { kind: 'onPath', anchor: 0, segment: [3, 4] },
  }) as never);
  let editing: string = triangle;
  let selected: ReadonlySet<number> = new Set();
  let selectedMark: PathEditMark | null = null;
  const extensions = [createConstraintsExtension()];
  const state: EditAnchorsStateRef = {
    getEditingId: () => editing,
    setEditingId: (id) => { editing = id ?? ''; },
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
  const { result, rerender } = renderHook(() => {
    useEditAnchorsDepSource(loose, { current: [editing] } as unknown as SelectionApi, adapter, state);
    return useDepRegistry();
  }, { wrapper: ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children) });
  const dep = () => (result.current.get as (key: string) => EditAnchorsDep)('editAnchors');
  const followers = () => (result.current.get as (key: string) => TransformFollower[] | undefined)('transformFollowers') ?? [];
  const deps = () => ({
    editAnchors: dep(), transformFollowers: followers(), selection: { get: () => [editing] }, scene: loose, applyOps: adapter.applyOps,
  }) as unknown as ActionDeps;
  const points = (id: NodeId) => pathAnchorPoints(scene.get(id)!.pose as PolygonPath);
  const ctx = (x: number, y: number, anchor: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: deps(),
    drag: { start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 }, affordance: { kind: `anchor:${anchor}` } },
  });
  /** Edit `id`: press its anchor `anchor`, move it by `(dx, dy)`, and release; answers each node's preview. */
  const drag = (id: NodeId, anchor: number, dx: number, dy: number) => {
    editing = id;
    rerender();
    const p = points(id)[anchor];
    const handle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx(p.x, p.y, anchor), undefined);
    handle.onMove!(ctx(p.x + dx, p.y + dy, anchor));
    const ids = [...(handle.previewIds!() ?? [])];
    const previews = new Map(ids.map((pid) => [pid, pathAnchorPoints(handle.previewPose!(pid) as PolygonPath)]));
    handle.onEnd!(ctx(p.x + dx, p.y + dy, anchor), 'commit');
    return previews;
  };
  const select = (id: NodeId, ...flat: number[]) => {
    editing = id;
    selected = new Set(flat);
    rerender();
  };
  const run = (action: { invoker?: unknown }) => (action.invoker as ImmediateInvoker).run(deps(), undefined);
  /** Move node `id` whole by `(dx, dy)`, as a transform action commits it. */
  const move = (id: NodeId, dx: number, dy: number) => {
    const from = scene.get(id)!.pose as PolygonPath;
    const to = polygonFromPoints(pathAnchorPoints(from).map((p) => ({ x: p.x + dx, y: p.y + dy }))) as PolygonPath;
    let ops: Op[] | null = [createTransformOp({ id, from, to, label: 'Move' })];
    for (const follower of followers()) ops = ops && follower.finish(ops, 'Move');
    if (ops) adapter.applyOps(ops, 'Move');
  };
  /** Bend `id`'s segment under `(x, y)` by `(dx, dy)` and release; answers each node's preview. */
  const bend = (id: NodeId, x: number, y: number, dx: number, dy: number) => {
    editing = id;
    rerender();
    const at = (px: number, py: number): InvocationCtx => ({ ...ctx(px, py, 0), drag: undefined });
    const bendSegment = pathsPreset.actions!.find((a) => a.id === 'bendSegment')!;
    const handle = (bendSegment.invoker as OngoingInvoker).start(at(x, y), undefined);
    handle.onMove!(at(x + dx, y + dy));
    const ids = [...(handle.previewIds!() ?? [])];
    const previews = new Map(ids.map((pid) => [pid, pathAnchorPoints(handle.previewPose!(pid) as PolygonPath)]));
    handle.onEnd!(at(x + dx, y + dy), 'commit');
    return previews;
  };
  /** Alt-drag `id`'s anchor `anchor` by `(dx, dy)` and release. */
  const linkDrag = (id: NodeId, anchor: number, dx: number, dy: number) => {
    editing = id;
    rerender();
    const p = points(id)[anchor];
    const alt = (x: number, y: number): InvocationCtx => {
      const c = ctx(x, y, anchor);
      return { ...c, modifiers: { ...c.modifiers, alt: true } };
    };
    const handle = (linkAnchorAction.invoker as OngoingInvoker).start(alt(p.x, p.y), undefined);
    handle.onMove!(alt(p.x + dx, p.y + dy));
    handle.onEnd!(alt(p.x + dx, p.y + dy), 'commit');
  };
  /** Drag node `id` whole by `(dx, dy)` with the move action and release; answers each node's preview mid-drag. */
  const moveDrag = (id: NodeId, dx: number, dy: number) => {
    const moveDeps = { ...deps(), selection: { get: () => [id], adapterMethods: undefined } } as unknown as ActionDeps;
    const at = (moving: boolean): InvocationCtx => ({
      world: moving ? { x: 50 + dx, y: 50 + dy } : { x: 50, y: 50 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: moveDeps,
      drag: moving ? { start: { x: 50, y: 50 }, current: { x: 50 + dx, y: 50 + dy }, delta: { x: dx, y: dy } } : undefined,
    }) as unknown as InvocationCtx;
    const handle = (moveAction.invoker as OngoingInvoker).start(at(false), undefined);
    handle.onMove!(at(true));
    const ids = [...(handle.previewIds!() ?? [])];
    const previews = new Map(ids.map((pid) => [pid, pathAnchorPoints(handle.previewPose!(pid) as PolygonPath)]));
    handle.onEnd!(at(true), 'commit');
    return previews;
  };
  const links = () => [...scene.renderOrderNodes()].flatMap((n) => {
    const c = constraintLinkOf(n.data);
    return c && n.id !== link ? [{ id: n.id, nodes: n.dependsOn, constraint: c }] : [];
  });
  return { scene, square, triangle, link, drag, points, select, run, move, bend, linkDrag, links, moveDrag };
}

describe('constraint links', () => {
  it('slides an anchor held on another node along it, leaving that node alone', () => {
    const t = setup();
    t.drag(t.triangle, 0, 15, 20);
    const [a] = t.points(t.triangle);
    expect(a.x).toBeCloseTo(55, 1);
    expect(Math.abs(a.y)).toBeLessThan(1e-3);
    expect(t.points(t.square)).toEqual(pathAnchorPoints(poly([0, 0], [100, 0], [100, 100], [0, 100])));
  });

  it('carries the held anchor when the other node is edited, previewed and undone as one', () => {
    const t = setup();
    const previews = t.drag(t.square, 1, 0, 40);
    expect([...previews.keys()].sort()).toEqual([t.square, t.triangle].sort());
    const [a, b] = t.points(t.triangle);
    expect(previews.get(t.triangle)).toEqual(t.points(t.triangle));
    // On the square's tilted bottom edge, and still straight below the triangle's next anchor.
    const [s0, s1] = t.points(t.square);
    expect(s1).toEqual({ x: 100, y: 40 });
    expect(Math.abs((s1.x - s0.x) * (a.y - s0.y) - (s1.y - s0.y) * (a.x - s0.x)) / 100).toBeLessThan(1e-3);
    expect(a.x).toBeCloseTo(b.x, 3);
    t.scene.undo();
    expect(t.points(t.triangle)[0]).toEqual({ x: 40, y: 0 });
    expect(t.points(t.square)[1]).toEqual({ x: 100, y: 0 });
  });

  it('renumbers a link through an edit of a node it ties, and goes when its anchor does', () => {
    const t = setup();
    t.select(t.triangle, 2);
    t.run(deleteAnchorsAction);
    expect(constraintLinkOf(t.scene.get(t.link)?.data)).toEqual({ kind: 'onPath', anchor: 0, segment: [2, 3] });
    t.select(t.square, 0);
    t.run(deleteAnchorsAction);
    expect(t.scene.get(t.link)).toBeUndefined();
    t.scene.undo();
    expect(t.scene.get(t.link)).toBeDefined();
  });

  it('goes with a node it ties, and draws nothing', () => {
    const t = setup();
    const shape = findNodeShape(t.scene.get(t.link)! as never)!;
    expect(shape.id).toBe('path-tools:constraint-link');
    expect(shape.paint(t.scene.get(t.link)! as never, undefined as never)).toEqual([]);
    t.scene.remove(t.square);
    expect(t.scene.get(t.link)).toBeUndefined();
  });
  it('carries a linked node with a whole-node move, as one undo step', () => {
    const t = setup();
    t.move(t.square, 0, 30);
    expect(t.points(t.square)[0]).toEqual({ x: 0, y: 30 });
    const [a, b] = t.points(t.triangle);
    expect(a.x).toBeCloseTo(40, 3);
    expect(a.y).toBeCloseTo(30, 3);
    expect(b).toEqual({ x: 40, y: -50 });
    expect(constraintLinkConflictsOf(t.scene, t.square)).toEqual([]);
    t.scene.undo();
    expect(t.points(t.triangle)[0]).toEqual({ x: 40, y: 0 });
    expect(t.points(t.square)[0]).toEqual({ x: 0, y: 0 });
  });

  it('moves a node whose link cannot follow, and reports the link it breaks', () => {
    const t = setup();
    t.scene.update(t.triangle, { data: { constraints: [{ kind: 'fixed', anchor: 0 }] } } as never);
    t.move(t.square, 0, 30);
    expect(t.points(t.square)[0]).toEqual({ x: 0, y: 30 });
    expect(t.points(t.triangle)[0]).toEqual({ x: 40, y: 0 });
    expect(constraintLinkConflictsOf(t.scene, t.square)).toEqual([t.link]);
    expect(constraintLinkConflictsOf(t.scene, t.triangle)).toEqual([t.link]);
  });
  it('previews the linked nodes through a drag that only previews until it commits', () => {
    const t = setup();
    const previews = t.bend(t.square, 70, 0, 0, 30);
    expect([...previews.keys()].sort()).toEqual([t.square, t.triangle].sort());
    expect(previews.get(t.triangle)).toEqual(t.points(t.triangle));
    expect(t.points(t.triangle)[0].y).toBeGreaterThan(1);
  });
  it('links an anchor Alt-dragged onto another node\'s anchor, in the move\'s undo step', () => {
    const t = setup();
    t.linkDrag(t.triangle, 2, -9, 49);
    expect(t.points(t.triangle)[2]).toEqual({ x: 0, y: 0 });
    const [made] = t.links();
    expect(made.nodes).toEqual([t.triangle, t.square]);
    expect(made.constraint).toEqual({ kind: 'coincident', anchors: [2, 3] });
    expect(t.scene.get(made.id as NodeId)!.layer).toBe('notes');
    t.move(t.square, 5, 0);
    expect(t.points(t.triangle)[2].x).toBeCloseTo(5, 3);
    t.scene.undo();
    t.scene.undo();
    expect(t.links()).toEqual([]);
    expect(t.points(t.triangle)[2]).toEqual({ x: 10, y: -50 });
  });

  it('links an anchor Alt-dragged onto another node\'s segment, and moves it plainly anywhere else', () => {
    const t = setup();
    t.linkDrag(t.triangle, 2, 50, 51);
    expect(t.points(t.triangle)[2]).toEqual({ x: 60, y: 0 });
    expect(t.links().map((l) => l.constraint)).toEqual([{ kind: 'onPath', anchor: 2, segment: [3, 4] }]);
    t.linkDrag(t.triangle, 1, 0, -20);
    expect(t.points(t.triangle)[1]).toEqual({ x: 40, y: -70 });
    expect(t.links()).toHaveLength(1);
  });

  it('previews a linked node following a move drag, as the move commits it', () => {
    const t = setup();
    const previews = t.moveDrag(t.square, 0, 30);
    expect([...previews.keys()].sort()).toEqual([t.square, t.triangle].sort());
    expect(previews.get(t.triangle)![0].y).toBeCloseTo(30, 3);
    expect(previews.get(t.triangle)).toEqual(t.points(t.triangle));
  });
});
