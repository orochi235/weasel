/**
 * Make Boolean Group and Ungroup commit through a consumer's
 * `applyOps` as one entry, selection included, so that history's undo puts
 * back the tree and the selection the action started from.
 */
import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { createHistory } from '@weasel-js/history';
import type { Op, NodeId, RectPose } from '@weasel-js/core';
import { createScene, defaultCommitAdapter } from '@weasel-js/core/engine';
import { makeBooleanGroupAction, groupAction, ungroupAction } from '@weasel-js/editing';

function rig<TPose>(scene: ReturnType<typeof createScene<object, 'main', TPose>>, ids: readonly string[]) {
  let held = [...ids] as NodeId[];
  const selection = { get: () => held, set: (next: readonly NodeId[]) => { held = [...next]; } };
  const history = createHistory(defaultCommitAdapter(scene as never, {
    getSelection: () => held, setSelection: (next) => selection.set(next),
  }));
  let batches = 0;
  const applyOps = (ops: Op[], label: string) => { batches++; history.applyOps(ops, label); };
  const deps = { scene, operands: selection, applyOps } as unknown as ActionDeps;
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
    expect(scene.roots).toEqual([group, c]);
    const posed = [a, b].map((id) => scene.get(id)!.pose);
    run(ungroupAction, r.deps);
    expect(r.batches()).toBe(2);
    expect(scene.roots).toEqual([a, b, c]);
    expect(r.selected()).toEqual([a, b]);
    expect(scene.get(a)!.pose).toEqual(box(0));
    r.history.undo();
    expect(scene.roots).toEqual([group, c]);
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
});
