/**
 * A drop into a layout container turned a quarter: the strategy's drag hooks
 * see the container upright, in its own frame, so its slots run along the
 * container's axes in the preview and in the commit.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { expectSamePose } from 'core/scene/frameFixture';
import { createTransformOp } from 'core/ops/transform';
import type { NodeId, RectPose } from 'core/scene/types';
import type { ContainerBounds, LayoutChild, LayoutStrategy } from '../../../layout/types';
import { scenePoseFrame } from '../poseFrame';

/** Rows 10 tall down the container from its top: the drop takes the first,
 *  and the children already there shift down a row. */
function rows(seen: { bounds: ContainerBounds[]; children: RectPose[] }) {
  const slot = (b: ContainerBounds): RectPose => ({ x: b.x, y: b.y, width: b.width, height: 10 });
  const down = (p: RectPose): RectPose => ({ ...p, y: p.y + 10 });
  return {
    snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
    childPoses: () => new Map(),
    getDropTargets: (c: { bounds: ContainerBounds }, children: LayoutChild<RectPose>[]) => {
      seen.bounds.push(c.bounds);
      seen.children.push(...children.map((k) => k.pose));
      return [{ pose: slot(c.bounds), origin: { x: c.bounds.x, y: c.bounds.y } }];
    },
    reflowPoses: (_c: unknown, children: LayoutChild<RectPose>[], d: { id: string }) =>
      new Map(children.filter((k) => k.id !== d.id).map((k) => [k.id, down(k.pose)])),
    commitDrop: (_c: unknown, children: LayoutChild<RectPose>[], d: { id: string; originPose: RectPose }, target: { pose: RectPose }) => [
      ...children.filter((k) => k.id !== d.id).map((k) =>
        createTransformOp<RectPose>({ id: k.id, from: k.pose, to: down(k.pose), label: 'Shift' })),
      createTransformOp<RectPose>({ id: d.id, from: d.originPose, to: target.pose, label: 'Drop' }),
    ],
  } as unknown as LayoutStrategy<unknown>;
}

describe('moveAction — layout drop into a turned container', () => {
  it('hands the strategy the container upright and lands the drop along its axes', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    // 50 wide and 200 tall, turned about its center (125, 200).
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 50, height: 200, rotation: Math.PI / 2 } });
    const held = scene.add({ kind: 'mark', layer: 'main', parent: box, data: {}, pose: { x: 0, y: 0, width: 50, height: 10 } });
    const dragged = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 10 } });
    const seen = { bounds: [] as ContainerBounds[], children: [] as RectPose[] };
    const layout = rows(seen);

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
    // The dragged box's center (10, 5) onto the container's (125, 200).
    const drag = { start: { x: 10, y: 5 }, current: { x: 125, y: 200 }, delta: { x: 115, y: 195 } };
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);

    expect(seen.bounds[0]).toEqual({ x: 100, y: 100, width: 50, height: 200 });
    expectSamePose(seen.children[0], { x: 100, y: 100, width: 50, height: 10 });
    const frame = RIGID_POSE_COMPOSITION.compose(scene.get(box)!.pose, { x: 0, y: 10, width: 50, height: 10 });
    expectSamePose(scenePoseFrame(scene as never).world(held) as RectPose, frame);

    handle.onEnd!({ ...base, world: drag.current, drag } as unknown as InvocationCtx, 'commit');
    expect(scene.get(dragged)!.parent).toBe(box);
    expectSamePose(scene.get(dragged)!.pose, { x: 0, y: 0, width: 50, height: 10 });
    expectSamePose(scene.get(held)!.pose, { x: 0, y: 10, width: 50, height: 10 });
  });
});
