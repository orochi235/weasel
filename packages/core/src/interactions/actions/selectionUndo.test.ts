/**
 * An action that selects what it made puts the selection change in its own
 * undo entry, so undoing it restores the selection it started from — under
 * the scene's history, and under a consumer's `applyOps` whose history knows
 * nothing about the selection.
 */
import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { createHistory } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import { joinPathsAction, snipAtCrossingsAction } from './pathCommands/cutJoin';
import { duplicateSelection } from './defaults/duplicate';
import { deleteAction } from './defaults/delete';
import { groupAction } from './defaults/group';
import { cloneAction } from './clone/action';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';

type AnyScene = ReturnType<typeof createScene<object, 'main', unknown>>;

const line = (x0: number, y0: number, x1: number, y1: number) => new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();

/** A selection held apart from the scene, as `useSelection` without a `scene` keeps it. */
function heldSelection(ids: readonly string[]) {
  let held = [...ids] as NodeId[];
  const api = {
    get: () => held,
    set: (next: readonly NodeId[]) => { held = [...next]; },
    adapterMethods: { getSelection: () => held, setSelection: (next: NodeId[]) => { held = [...next]; } },
  };
  return api;
}

/** Deps committing through a consumer history over the scene's own mutators. */
function consumerDeps(scene: AnyScene, selection: ReturnType<typeof heldSelection>) {
  const history = createHistory(defaultCommitAdapter(scene as never, selection.adapterMethods));
  const applyOps = (ops: Op[], label: string) => history.applyOps(ops, label);
  return { deps: { scene, selection, applyOps } as unknown as ActionDeps, history };
}

function crossing() {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(0, 50, 100, 50) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(50, 0, 50, 100) });
  return { scene, a, b };
}

function ends() {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(0, 0, 10, 0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: line(10, 0, 20, 0) });
  return { scene, a, b };
}

const run = (action: { invoker?: unknown }, deps: ActionDeps) => (action.invoker as ImmediateInvoker).run(deps);

describe('undo restores the selection an action started from', () => {
  it('Cut at Crossings', () => {
    const { scene, a, b } = crossing();
    const selection = heldSelection([a, b]);
    const { deps, history } = consumerDeps(scene, selection);
    run(snipAtCrossingsAction, deps);
    expect(selection.get()).toHaveLength(4);
    history.undo();
    expect(selection.get()).toEqual([a, b]);
  });

  it('Join', () => {
    const { scene, a, b } = ends();
    const selection = heldSelection([a, b]);
    const { deps, history } = consumerDeps(scene, selection);
    run(joinPathsAction, deps);
    expect(selection.get()).toEqual([a]);
    history.undo();
    expect(selection.get()).toEqual([a, b]);
  });

  it('Duplicate', () => {
    const { scene, a } = ends();
    const selection = heldSelection([a]);
    const { deps, history } = consumerDeps(scene, selection);
    const copies = duplicateSelection(deps, 12, 12);
    expect(selection.get()).toEqual(copies);
    history.undo();
    expect(selection.get()).toEqual([a]);
  });

  it('Delete', () => {
    const { scene, a, b } = ends();
    const selection = heldSelection([a, b]);
    const { deps, history } = consumerDeps(scene, selection);
    run(deleteAction, deps);
    expect(selection.get()).toEqual([]);
    history.undo();
    expect(selection.get()).toEqual([a, b]);
  });

  it('Group', () => {
    const { scene, a, b } = ends();
    const selection = heldSelection([a, b]);
    const { deps, history } = consumerDeps(scene, selection);
    run(groupAction, deps);
    expect(selection.get()).toHaveLength(1);
    expect(selection.get()[0]).not.toBe(a);
    history.undo();
    expect(selection.get()).toEqual([a, b]);
  });

  it('Clone', () => {
    const { scene, a } = ends();
    const selection = heldSelection([a]);
    const { deps, history } = consumerDeps(scene, selection);
    const ctx = (dx: number) => ({
      world: { x: dx, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false },
      deps,
      drag: { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 } },
    }) as unknown as InvocationCtx;
    const handle = (cloneAction.invoker as OngoingInvoker).start(ctx(0), undefined);
    handle.onMove!(ctx(30));
    handle.onEnd!(ctx(30), 'commit');
    expect(selection.get()).toHaveLength(1);
    expect(selection.get()[0]).not.toBe(a);
    history.undo();
    expect(selection.get()).toEqual([a]);
  });
});
