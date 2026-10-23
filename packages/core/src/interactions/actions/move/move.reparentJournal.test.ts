/**
 * Reparent-on-drop into a container that refuses the arrival, while a journal
 * opened on the scene's history is taking the batches: nothing lands and the
 * move reports no commit.
 */
import { describe, it, expect, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const HOME: RectPose = { x: 0, y: 0, width: 10, height: 10 };

const refusing: LayoutStrategy<RectPose> = {
  snap: { pickTarget: () => null },
  childPoses: () => new Map(),
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
  arrive: () => null,
};

describe('moveAction — a refused reparent under an active journal', () => {
  it('lands nothing and reports no commit', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: HOME });
    scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 }, layout: refusing });
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));
    const onGestureEnd = vi.fn();

    const invoker = moveAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const deps = { selection: { get: () => [A] }, scene, nodeAtPoint: () => T };
    const handle = invoker.start(
      { world: { x: 5, y: 5 }, modifiers: MODS, deps } as unknown as InvocationCtx,
      { params: { reparentOnDrop: 'top', onGestureEnd } },
    );
    const drag = { start: { x: 5, y: 5 }, current: { x: 55, y: 5 }, delta: { x: 50, y: 0 } };
    const at = { world: drag.current, modifiers: MODS, deps, drag } as unknown as InvocationCtx;
    handle.onMove!(at);
    handle.onEnd!(at, 'commit');

    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(HOME);
    expect(journal.entries().undo).toHaveLength(0);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
