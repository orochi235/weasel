/**
 * A layout drop that shifts a sibling container to make room: the sibling's
 * own children move with it, in the drag's preview and in its commit, carried
 * by its frame.
 */
import { scenePoseFrame } from '../poseFrame';
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { createTransformOp } from 'core/ops/transform';
import type { LayoutStrategy } from '../../../layout/types';

interface P { x: number; y: number; width: number; height: number }

describe('moveAction — layout drop shifting a sibling container', () => {
  it('takes the shifted sibling\'s children along', () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 } });
    const sibling = scene.add({ kind: 'group', layer: 'main', parent: box, data: {}, pose: { x: 0, y: 0, width: 200, height: 40 } });
    const member = scene.add({ kind: 'mark', layer: 'main', parent: sibling, data: {}, pose: { x: 10, y: 10, width: 10, height: 10 } });
    const dragged = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 200, height: 40 } });
    const slot: P = { x: 100, y: 100, width: 200, height: 40 };
    const shifted: P = { x: 100, y: 140, width: 200, height: 40 };
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => [{ pose: slot, origin: { x: slot.x, y: slot.y } }],
      reflowPoses: () => new Map([[sibling as string, shifted]]),
      commitDrop: (_c: unknown, _k: unknown, d: { id: string; originPose: P }, target: { pose: P }) => [
        createTransformOp<P>({ id: sibling as string, from: slot, to: shifted, label: 'Shift' }),
        createTransformOp<P>({ id: d.id, from: d.originPose, to: target.pose, label: 'Drop' }),
      ],
    } as unknown as LayoutStrategy<unknown>;

    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [dragged] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === box ? layout : null) },
      },
    };
    const drag = { start: { x: 20, y: 20 }, current: { x: 150, y: 120 }, delta: { x: 130, y: 100 } };
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);
    expect(scenePoseFrame(scene as never).world(member)).toEqual({ x: 110, y: 150, width: 10, height: 10 });
    handle.onEnd!({ ...base, world: drag.current, drag } as unknown as InvocationCtx, 'commit');

    expect(scene.get(sibling)!.pose).toEqual({ x: 0, y: 40, width: 200, height: 40 });
    expect(scene.get(member)!.pose).toEqual({ x: 10, y: 10, width: 10, height: 10 });
    expect(scenePoseFrame(scene as never).world(member)).toEqual({ x: 110, y: 150, width: 10, height: 10 });
  });
});
