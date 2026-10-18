import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { pathAnchorPoints, polygonFromPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import {
  createScene, defaultCommitAdapter, deleteAnchorsAction, editAnchorsAction, findNodeShape,
  type EditAnchorsDep, type NodeId, type PathEditMark, type Scene, type SelectionApi,
} from '@weasel-js/core';
import {
  useEditAnchorsDepSourceForTests as useEditAnchorsDepSource, type EditAnchorsStateRef,
} from '@weasel-js/core/test-seams';
import { constraintLinkNode, constraintLinkOf } from './constraintLinks';
import { createConstraintsExtension } from './constraintsExtension';

type Data = { constraints?: PathConstraint[]; constraintLink?: PathConstraint };

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;

/**
 * A square, and a triangle whose anchor 0 is held on the square's bottom edge
 * by a link node: in link numbering the triangle's anchors come first, so the
 * square's anchors 0 → 1 are 3 → 4.
 */
function setup() {
  const scene = createScene<Data, 'main' | 'notes', unknown>({ systemLayers: [{ id: 'main' }, { id: 'notes' }] });
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
  const deps = () => ({ editAnchors: dep(), selection: { get: () => [editing] } }) as unknown as ActionDeps;
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
  return { scene, square, triangle, link, drag, points, select, run };
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
});
