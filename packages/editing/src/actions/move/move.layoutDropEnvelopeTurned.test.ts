/** A group that is its members, dropped into a layout container turned a quarter: its members land in the slot. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene, unionOfChildren, RIGID_POSE_COMPOSITION, scenePoseFrame } from '@weasel-js/core/engine';
import { expectSamePoseForTests as expectSamePose } from '@weasel-js/core/test-seams';
import type { NodeId, RectPose } from '@weasel-js/core';
import type { ContainerBounds, LayoutStrategy } from '@weasel-js/core/engine';
import * as ops from '@weasel-js/core/ops';

const slotIn = (b: ContainerBounds, d: { pose: RectPose }): RectPose => ({ x: b.x, y: b.y, width: d.pose.width, height: d.pose.height });
const layout = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: (c: { bounds: ContainerBounds }, _k: unknown, d: { pose: RectPose }) => {
    const pose = slotIn(c.bounds, d);
    return [{ pose, origin: { x: pose.x, y: pose.y } }];
  },
  reflowPoses: () => new Map(),
  commitDrop: (_c: unknown, _k: unknown, d: { id: string; originPose: RectPose }, target: { pose: RectPose }) =>
    [ops.setPose<RectPose>({ id: d.id, from: d.originPose, to: target.pose, label: 'Drop' })],
} as unknown as LayoutStrategy<unknown>;

describe('moveAction — an envelope dropped into a turned layout container', () => {
  it('lands its members in the slot, in the container\'s frame', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 50, height: 200, rotation: Math.PI / 2 } });
    const group = scene.add({
      kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 },
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 30, y: 40, width: 10, height: 10 } });
    const mark = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 45, y: 40, width: 10, height: 10 } });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 40, y: 45 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { operands: { get: () => [group] as NodeId[] }, scene, layout: { getLayout: (cid: string) => (cid === box ? layout : null) } },
    };
    const drag = { start: { x: 40, y: 45 }, current: { x: 125, y: 200 }, delta: { x: 85, y: 155 } };
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);
    handle.onEnd!({ ...base, world: drag.current, drag } as unknown as InvocationCtx, 'commit');
    expect(scene.get(group)!.parent).toBe(box);
    const slot = RIGID_POSE_COMPOSITION.compose(scene.get(box)!.pose, { x: 15, y: 0, width: 10, height: 10 });
    expectSamePose(scenePoseFrame(scene as never).world(mark) as RectPose, slot);
  });
});
