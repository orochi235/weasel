/**
 * Each path-effect command and Trim puts its selection change in its own undo
 * entry, so a consumer's `applyOps` history that knows nothing of the
 * selection still restores it on undo.
 */
import { describe, expect, it } from 'vitest';
import { pathFromD, rectPath } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import {
  createScene, defaultCommitAdapter, type NodeId, type Op, type RectPose, type Scene, withPathEffectsRegistry,
} from '@weasel-js/core';
import { blendAction, expandPathEffectAction, textAlongAction } from './actions';
import { releaseBlendSpineAction, setBlendSpineAction } from './spine';
import { releasePathEffectAction, setEffectPathAction } from './retarget';
import { trimPathAction } from '../trim/trimSegment';

type TestScene = Scene<unknown, 'default', unknown>;

const line = (id: string, y: number) => ({
  id: id as NodeId, kind: 'mark' as const, layer: 'default' as const,
  pose: { x: 0, y, width: 200, height: 0 },
  data: { path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 200, 0]), fillRule: 'nonzero' }, stroke: { paint: { color: '#000' }, width: 1 } },
});
const box = (id: string, x: number) => ({
  id: id as NodeId, kind: 'mark' as const, layer: 'default' as const,
  pose: { x, y: 0, width: 20, height: 20 },
  data: { path: rectPath(0, 0, 20, 20), fill: { paint: { color: '#f00' } } },
});
const text = (id: string) => ({
  id: id as NodeId, kind: 'mark' as const, layer: 'default' as const,
  pose: { x: 0, y: 0, width: 100, height: 20 }, data: { text: 'Hi', style: { fontSize: 16 } },
});

/** A scene committed through a history of its own: each batch is one entry, and undo inverts it. */
function rig(initial: unknown[], selected: string[]) {
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }], registry: withPathEffectsRegistry(), initial: initial as never,
  }) as unknown as TestScene;
  let current = selected;
  const selection = { get: () => current, set: (next: readonly string[]) => { current = [...next]; } };
  const adapter = defaultCommitAdapter(scene, { getSelection: () => current as NodeId[], setSelection: (ids) => selection.set(ids) });
  const entries: Op[][] = [];
  const applyOps = (ops: Op[]) => {
    for (const op of ops) op.apply(adapter);
    entries.push(ops);
  };
  const undo = () => {
    for (const op of [...entries.pop()!].reverse()) op.invert().apply(adapter);
  };
  const deps = { scene, selection, applyOps } as unknown as ActionDeps;
  return { scene, deps, undo, selected: () => current, select: (ids: string[]) => { current = ids; } };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps, params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

describe('undo restores the selection a path command started from', () => {
  it('applying an effect', () => {
    const r = rig([box('a', 0), box('b', 180)], ['a', 'b']);
    run(blendAction, r.deps);
    expect(r.selected()).toHaveLength(1);
    r.undo();
    expect(r.selected()).toEqual(['a', 'b']);
  });

  it('expanding an effect', () => {
    const r = rig([box('a', 0), box('b', 180)], ['a', 'b']);
    run(blendAction, r.deps);
    const blend = r.selected();
    run(expandPathEffectAction, r.deps);
    expect(r.selected()).not.toEqual(blend);
    r.undo();
    expect(r.selected()).toEqual(blend);
  });

  it('setting and releasing a blend spine', () => {
    const r = rig([box('a', 0), box('b', 180), line('s1', 100)], ['a', 'b']);
    run(blendAction, r.deps);
    const blend = r.selected()[0]!;
    r.select([blend, 's1']);
    run(setBlendSpineAction, r.deps);
    expect(r.selected()).toEqual([blend]);
    r.undo();
    expect(r.selected()).toEqual([blend, 's1']);
    run(setBlendSpineAction, r.deps);
    run(releaseBlendSpineAction, r.deps);
    expect(r.selected()).toEqual(['s1']);
    r.undo();
    expect(r.selected()).toEqual([blend]);
  });

  it('setting and releasing an effect path', () => {
    const r = rig([line('p', 100), text('t'), line('q', 200)], ['p', 't']);
    run(textAlongAction, r.deps);
    const fx = r.selected()[0]!;
    r.select([fx, 'q']);
    run(setEffectPathAction, r.deps);
    expect(r.selected()).toEqual([fx]);
    r.undo();
    expect(r.selected()).toEqual([fx, 'q']);
    r.select([fx]);
    run(releasePathEffectAction, r.deps);
    expect(r.selected()).toEqual(['t', 'p']);
    r.undo();
    expect(r.selected()).toEqual([fx]);
  });

  it('trimming a stroke away entirely', () => {
    const pathNode = (id: string, d: string) => ({ id: id as NodeId, kind: 'mark' as const, layer: 'default' as const, pose: pathFromD(d), data: {} });
    const r = rig([pathNode('stub', 'M10 0 H20'), pathNode('w1', 'M10 -10 V10'), pathNode('w2', 'M20 -10 V10')], ['stub', 'w1']);
    run(trimPathAction, r.deps, { press: { x: 15, y: 0 }, radiusPx: 3 });
    expect(r.scene.get('stub' as NodeId)).toBeUndefined();
    expect(r.selected()).toEqual(['w1']);
    r.undo();
    expect(r.selected()).toEqual(['stub', 'w1']);
  });
});
