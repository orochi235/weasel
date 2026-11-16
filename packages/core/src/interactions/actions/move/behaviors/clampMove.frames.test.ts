import { describe, expect, it } from 'vitest';
import type { BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import type { NodeId, RectPose } from 'core/scene/types';
import { scenePoseFrame } from '../../poseFrame';
import { moveAction } from '../action';
import { clampMove } from './clampMove';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

describe('clampMove on a node inside an offset group', () => {
  it('keeps its world box inside the world bounds', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const g = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 10, height: 10 } });
    const c = scene.add({ kind: 'mark', parent: g, layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
    const base = { world: { x: 105, y: 105 }, modifiers: MODS, deps: { operands: { get: () => [c] as NodeId[] }, scene } };
    const at = (x: number): InvocationCtx => ({
      ...base, world: { x, y: 105 }, drag: { start: { x: 105, y: 105 }, current: { x, y: 105 }, delta: { x: x - 105, y: 0 } },
    }) as unknown as InvocationCtx;
    const behaviors = [clampMove<RectPose>({ bounds: { x: 0, y: 0, width: 200, height: 200 } })];
    const handle = (moveAction.invoker as OngoingInvoker).start(base as unknown as InvocationCtx, { behaviors } as BindingOptions) as OngoingHandle;
    handle.onMove!(at(255));
    handle.onEnd!(at(255), 'commit');
    const world = scenePoseFrame(scene as never).world(c) as RectPose;
    expect(world.x + world.width).toBeCloseTo(200);
  });
});
