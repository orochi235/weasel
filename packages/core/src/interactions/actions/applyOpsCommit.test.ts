/**
 * Make Boolean Group, Ungroup and Offset Path commit through a consumer's
 * `applyOps` as one entry, selection included, so that history's undo puts
 * back the tree and the selection the action started from.
 */
import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createHistory } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import type { NodeId, RectPose } from 'core/scene/types';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import { makeBooleanGroupAction } from './booleans/booleanGroupAction';
import { groupAction, ungroupAction } from './defaults/group';
import { offsetPathAction } from './pathCommands/simplifyOffset';

function rig<TPose>(scene: ReturnType<typeof createScene<object, 'main', TPose>>, ids: readonly string[]) {
  let held = [...ids] as NodeId[];
  const selection = { get: () => held, set: (next: readonly NodeId[]) => { held = [...next]; } };
  const history = createHistory(defaultCommitAdapter(scene as never, {
    getSelection: () => held, setSelection: (next) => selection.set(next),
  }));
  let batches = 0;
  const applyOps = (ops: Op[], label: string) => { batches++; history.applyOps(ops, label); };
  const deps = { scene, selection, applyOps } as unknown as ActionDeps;
  return { deps, history, selected: () => held, select: (next: string[]) => { held = next as NodeId[]; }, batches: () => batches };
}

const box = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

function boxes() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50) });
  const c = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(100) });
  return { scene, a, b, c };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps) => (action.invoker as ImmediateInvoker).run(deps);

describe('commits through applyOps, undone by its history', () => {
  it('Make Boolean Group', () => {
    const { scene, a, b, c } = boxes();
    const r = rig(scene, [b, a]);
    run(makeBooleanGroupAction, r.deps);
    expect(r.batches()).toBe(1);
    const [group] = r.selected();
    expect(scene.childrenOf(group!)).toEqual([a, b]);
    expect(scene.roots).toEqual([group, c]);
    r.history.undo();
    expect(scene.roots).toEqual([a, b, c]);
    expect(scene.get(group!)).toBeUndefined();
    expect(r.selected()).toEqual([b, a]);
  });

  it('Ungroup', () => {
    const { scene, a, b, c } = boxes();
    const r = rig(scene, [a, b]);
    run(groupAction, r.deps);
    const [group] = r.selected();
    expect(scene.roots).toEqual([c, group]);
    const posed = [a, b].map((id) => scene.get(id)!.pose);
    run(ungroupAction, r.deps);
    expect(r.batches()).toBe(2);
    expect(scene.roots).toEqual([c, a, b]);
    expect(r.selected()).toEqual([a, b]);
    expect(scene.get(a)!.pose).toEqual(box(0));
    r.history.undo();
    expect(scene.roots).toEqual([c, group]);
    expect(scene.childrenOf(group!)).toEqual([a, b]);
    expect([a, b].map((id) => scene.get(id)!.pose)).toEqual(posed);
    expect(r.selected()).toEqual([group]);
  });

  it('Ungroup of a group and the group inside it', () => {
    const { scene, a, b, c } = boxes();
    const r = rig(scene, [a, b]);
    run(groupAction, r.deps);
    const [inner] = r.selected();
    r.select([inner!, c]);
    run(groupAction, r.deps);
    const [outer] = r.selected();
    const before = JSON.stringify(scene.toJSON().nodes);
    r.select([inner!, outer!]);
    run(ungroupAction, r.deps);
    expect(scene.get(inner!)).toBeUndefined();
    expect(scene.get(outer!)).toBeUndefined();
    expect(new Set(scene.roots)).toEqual(new Set([a, b, c]));
    expect([a, b, c].map((id) => scene.get(id)!.pose)).toEqual([box(0), box(50), box(100)]);
    expect(new Set(r.selected())).toEqual(new Set([a, b, c]));
    r.history.undo();
    expect(JSON.stringify(scene.toJSON().nodes)).toBe(before);
    expect(r.selected()).toEqual([inner, outer]);
  });

  it('Offset Path', () => {
    const scene = createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const p = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: square });
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
