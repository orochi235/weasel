/**
 * A container dropped into a layout container, on a scene with the default
 * absolute poses: the layout places the container, and its children have to
 * land with it though no drag delta describes where that is.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { createTransformOp } from 'core/ops/transform';
import type { LayoutStrategy } from '../../../layout/types';

interface P { x: number; y: number; width: number; height: number }

describe('moveAction — layout drop of a container', () => {
  it('moves the children by where the layout put the container', () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 } });
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 40, height: 40 } });
    const child = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 5, y: 5, width: 10, height: 10 } });
    const slot: P = { x: 120, y: 130, width: 40, height: 40 };
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => [{ pose: slot, origin: { x: slot.x, y: slot.y } }],
      reflowPoses: () => new Map(),
      commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: P }, target: { pose: P }) =>
        [createTransformOp<P>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
    } as unknown as LayoutStrategy<unknown>;

    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [group] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === box ? layout : null) },
      },
    };
    const drag = { start: { x: 20, y: 20 }, current: { x: 200, y: 200 }, delta: { x: 180, y: 180 } };
    const handle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);
    handle.onEnd!({ ...base, world: drag.current, drag } as unknown as InvocationCtx, 'commit');

    expect(scene.get(group)!.parent).toBe(box);
    expect(scene.get(group)!.pose).toEqual(slot);
    expect(scene.get(child)!.parent).toBe(group);
    expect(scene.get(child)!.pose).toEqual({ x: 125, y: 135, width: 10, height: 10 });
  });
});
