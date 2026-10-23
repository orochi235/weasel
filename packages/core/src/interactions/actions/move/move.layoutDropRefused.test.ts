/**
 * A layout drop whose arrival the destination refuses lands nothing and
 * reports no commit, whichever route the commit takes.
 */
import { describe, it, expect, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const HOME: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const SLOT: RectPose = { x: 120, y: 130, width: 10, height: 10 };

/** Takes the drop while dragging, then refuses the arrival it commits. */
const refusing = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: () => [{ pose: SLOT, origin: { x: SLOT.x, y: SLOT.y } }],
  reflowPoses: () => new Map(),
  commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: RectPose }, target: { pose: RectPose }) =>
    [createTransformOp<RectPose>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
  arrive: () => null,
} as unknown as LayoutStrategy<RectPose>;

function dropInto(params: Record<string, unknown>) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: HOME });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 }, layout: refusing });
  const onGestureEnd = vi.fn();
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const base = {
    world: { x: 5, y: 5 },
    modifiers: MODS,
    deps: { selection: { get: () => [A] }, scene, layout: { getLayout: (id: string) => (id === T ? refusing : null) } },
  };
  const handle = invoker.start(base as unknown as InvocationCtx, { params: { onGestureEnd, ...params } });
  const drag = { start: { x: 5, y: 5 }, current: { x: 200, y: 200 }, delta: { x: 195, y: 195 } };
  const at = { ...base, world: drag.current, drag } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  return { scene, onGestureEnd };
}

describe('moveAction — a layout drop the destination refuses', () => {
  it('lands nothing and reports no commit', () => {
    const { scene, onGestureEnd } = dropInto({});
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('does the same when the move is transient', () => {
    const { scene, onGestureEnd } = dropInto({ transient: true });
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
