/**
 * The path commands commit through a consumer's `applyOps` as one entry, selection included, so
 * that history's undo puts back the tree and the selection the command started from; and they
 * cut and store paths in the frames of the nodes that hold them.
 */
import { describe, expect, it } from 'vitest';
import { PathBuilder, boundsOfPath, type PolygonPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createHistory } from '@weasel-js/history';
import {
  createScene, defaultCommitAdapter, IDENTITY_POSE_COMPOSITION, pathNodesOf, type AnyScene, type NodeId, type Op,
  type RectPose,
} from '@weasel-js/core';
import { joinPathsAction, snipAtCrossingsAction } from './cutJoin';
import { offsetPathAction } from './simplifyOffset';

const line = (x0: number, y0: number, x1: number, y1: number): PolygonPath =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build() as PolygonPath;

/** Deps committing through a consumer history over the scene's own mutators, with the selection held apart. */
function rig(scene: AnyScene, ids: readonly string[]) {
  let held = [...ids] as NodeId[];
  const selection = { get: () => held, set: (next: readonly NodeId[]) => { held = [...next]; } };
  const history = createHistory(defaultCommitAdapter(scene as never, {
    getSelection: () => held, setSelection: (next) => selection.set(next),
  }));
  let batches = 0;
  const applyOps = (ops: Op[], label: string) => { batches++; history.applyOps(ops, label); };
  const deps = { scene, selection, applyOps } as unknown as ActionDeps;
  return { deps, history, selection, selected: () => held, batches: () => batches };
}

const pathScene = () =>
  createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;

const run = (action: { invoker?: unknown }, deps: ActionDeps) => (action.invoker as ImmediateInvoker).run(deps);

describe('undo restores the selection a path command started from', () => {
  it('Cut at Crossings', () => {
    const scene = pathScene();
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(0, 50, 100, 50) } as never);
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(50, 0, 50, 100) } as never);
    const { deps, history, selected } = rig(scene, [a, b]);
    run(snipAtCrossingsAction, deps);
    expect(selected()).toHaveLength(4);
    history.undo();
    expect(selected()).toEqual([a, b]);
  });

  it('Join', () => {
    const scene = pathScene();
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(0, 0, 10, 0) } as never);
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(10, 0, 20, 0) } as never);
    const { deps, history, selected } = rig(scene, [a, b]);
    run(joinPathsAction, deps);
    expect(selected()).toEqual([a]);
    history.undo();
    expect(selected()).toEqual([a, b]);
  });

  it('Offset Path, as one batch', () => {
    const scene = pathScene();
    const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const p = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: square } as never);
    const r = rig(scene, [p]);
    const ctx = (params?: Record<string, unknown>) => ({
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: r.deps,
      ...(params ? { params } : {}),
    }) as unknown as InvocationCtx;
    const handle = (offsetPathAction.invoker as OngoingInvoker).start(ctx({ distance: 10 }), {});
    handle.onEnd!(ctx(), 'commit');
    expect(r.batches()).toBe(1);
    expect(r.selected()).toHaveLength(1);
    expect(r.selected()[0]).not.toBe(p);
    r.history.undo();
    expect(r.selected()).toEqual([p]);
  });
});

describe('a path command inside a frame', () => {
  it('cuts across a framed group at the crossing', () => {
    // A root line from x=50 to x=150 at y=50, and a vertical line at world x=100 stored in a group
    // whose frame sits at (90, 0).
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
    const root = scene.add({ kind: 'mark', layer: 'main', data: { path: line(0, 0, 100, 0) }, pose: { x: 50, y: 50, width: 100, height: 0 } } as never);
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 90, y: 0, width: 20, height: 100, rotation: 0 } } as never);
    const inner = scene.add({ kind: 'mark', parent: group, layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 } } as never);
    const applyOps = (ops: Op[], label: string) => { scene.applyBatch(ops, label, defaultCommitAdapter(scene)); };
    const deps = { scene, selection: { get: () => [root, inner], set: () => {} }, applyOps } as unknown as ActionDeps;
    run(snipAtCrossingsAction, deps);
    const leaves = [...scene.renderOrder()].filter((id) => scene.get(id)!.kind === 'mark');
    const world = pathNodesOf(scene, leaves).map((n) => {
      const b = boundsOfPath(n.path);
      return [b.x, b.y, b.x + b.width, b.y + b.height];
    });
    expect(world).toEqual([[50, 50, 100, 50], [100, 50, 150, 50], [100, 0, 100, 50], [100, 50, 100, 100]]);
    expect(leaves.slice(2).every((id) => scene.get(id as NodeId)!.parent === group)).toBe(true);
  });
});
