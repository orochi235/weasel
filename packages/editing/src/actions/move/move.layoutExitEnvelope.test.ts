/** A group that is its members, dragged out of a layout container: its members land where the drag showed them. */
import { describe, expect, it } from 'vitest';
import { moveAction } from './action';
import type { InvocationCtx, OngoingHandle, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { createScene, unionOfChildren, RIGID_POSE_COMPOSITION, scenePoseFrame } from '@weasel-js/core/engine';
import type { LayoutStrategy } from '@weasel-js/core/engine';
import { expectSamePoseForTests as expectSamePose } from '@weasel-js/core/test-seams';
import type { NodeId, RectPose } from '@weasel-js/core';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });
const DRAG = { start: { x: 115, y: 15 }, current: { x: 415, y: 15 }, delta: { x: 300, y: 0 } };

const layout = {
  childPoses: () => new Map(),
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
} as unknown as LayoutStrategy<unknown>;

function ctx(scene: S, ids: string[], container: string, drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? drag.current : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      operands: { get: () => ids } as unknown as SelectionApi,
      scene,
      layout: { getLayout: (id: string) => (id === container ? layout : null) },
    },
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction, an envelope leaving its layout container', () => {
  it('lands its members at the world place the drag gave them', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const list = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 0, 200, 200) });
    const group = scene.add({
      kind: 'group', layer: 'main', parent: list, data: {}, pose: box(10, 10),
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    const mark = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: box(10, 10) });
    const world = (id: string) => scenePoseFrame(scene as never).world(id as NodeId) as RectPose;
    expectSamePose(world(mark), box(110, 10));

    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [group], list), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [group], list, DRAG));
    handle.onEnd!(ctx(scene, [group], list, DRAG), 'commit');

    expect(scene.get(group)!.parent).toBeNull();
    expect(scene.get(mark)!.parent).toBe(group);
    expectSamePose(world(mark), box(410, 10));
  });
});
