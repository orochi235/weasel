/**
 * Reparent-on-drop in the move's behavior chain: last, so anything that
 * answers before it keeps the commit, and silent on a drag that went nowhere.
 */
import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import type { MoveBehavior } from '../../gestures/types';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const HOME: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const SLOT: RectPose = { x: 120, y: 130, width: 10, height: 10 };

function drop(dx: number, more: { behaviors?: MoveBehavior<unknown>[]; deps?: object } = {}) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: HOME });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 } });
  const nodeAtPoint = vi.fn(() => T);
  const onGestureEnd = vi.fn();
  const base = {
    world: { x: 5, y: 5 },
    modifiers: MODS,
    deps: { selection: { get: () => [A] }, scene, nodeAtPoint, ...more.deps },
  };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    base as unknown as InvocationCtx,
    { behaviors: more.behaviors ?? [], params: { reparentOnDrop: 'top', dragThresholdPx: 0, onGestureEnd } } as BindingOpts,
  );
  const drag = { start: { x: 5, y: 5 }, current: { x: 5 + dx, y: 5 + dx }, delta: { x: dx, y: dx } };
  const at = { ...base, world: drag.current, drag } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  return { scene, nodeAtPoint, onGestureEnd };
}

describe('moveAction — reparent-on-drop behind the other behaviors', () => {
  it('reparents under the node the pointer is released over', () => {
    const { scene, nodeAtPoint, onGestureEnd } = drop(195);
    expect(nodeAtPoint).toHaveBeenCalledTimes(1);
    expect(scene.get(A)!.parent).toBe(T);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('does not look for a drop target when a binding behavior answers at end', () => {
    const { scene, nodeAtPoint, onGestureEnd } = drop(195, { behaviors: [{ onEnd: () => [] }] });
    expect(nodeAtPoint).not.toHaveBeenCalled();
    expect(scene.get(A)!.parent).toBe(null);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('does not look for one when a layout drop took the selection', () => {
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => [{ pose: SLOT, origin: { x: SLOT.x, y: SLOT.y } }],
      reflowPoses: () => new Map(),
      commitDrop: () => [createTransformOp<RectPose>({ id: A, from: HOME, to: SLOT, label: 'Drop' })],
    } as unknown as LayoutStrategy<unknown>;
    const { scene, nodeAtPoint } = drop(195, { deps: { layout: { getLayout: (id: string) => (id === T ? layout : null) } } });
    expect(nodeAtPoint).not.toHaveBeenCalled();
    expect(scene.get(A)!.parent).toBe(T);
    expect(scene.get(A)!.pose).toEqual(SLOT);
  });

  it('does not look for one, or commit, on a drag that went nowhere', () => {
    const { scene, nodeAtPoint, onGestureEnd } = drop(0);
    expect(nodeAtPoint).not.toHaveBeenCalled();
    expect(scene.get(A)!.parent).toBe(null);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
