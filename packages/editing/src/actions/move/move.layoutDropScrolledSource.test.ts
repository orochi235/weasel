/** A child dragged out of a scrolled layout container: the leftovers are laid out in the frame they are shown in. */
import { describe, expect, it } from 'vitest';
import { moveAction } from './action';
import type { InvocationCtx, OngoingHandle, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { createScene, RIGID_POSE_COMPOSITION } from '@weasel-js/core/engine';
import type { LayoutStrategy, LayoutContainer, LayoutChild } from '@weasel-js/core/engine';
import * as ops from '@weasel-js/core/ops';
import type { RectPose } from '@weasel-js/core';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/** Stacks children 20 apart, from 160 down the content. */
const stack = {
  childPoses: (c: LayoutContainer, kids: readonly LayoutChild<unknown>[]) =>
    new Map(kids.map((k, i) => [k.id, box(c.bounds.x + 10, c.bounds.y + 160 + 20 * i)])),
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
} as unknown as LayoutStrategy<unknown>;

const slot = box(420, 20);
const bin = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: () => [{ pose: slot, origin: { x: slot.x, y: slot.y } }],
  reflowPoses: () => new Map(),
  commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: RectPose }, target: { pose: RectPose }) =>
    [ops.setPose<RectPose>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
} as unknown as LayoutStrategy<unknown>;

const DRAG = { start: { x: 115, y: 155 }, current: { x: 500, y: 100 }, delta: { x: 385, y: -55 } };

function ctx(scene: S, ids: string[], layouts: Record<string, LayoutStrategy<unknown>>, drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? drag.current : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      operands: { get: () => ids } as unknown as SelectionApi,
      scene,
      layout: { getLayout: (id: string) => layouts[id] ?? null },
    },
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction, a layout drop out of a scrolled container', () => {
  it('leaves the leftovers where the scrolled content shows them', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const list = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 100, 100, 100) });
    const a = scene.add({ kind: 'mark', parent: list, layer: 'main', data: {}, pose: box(10, 160) });
    const b = scene.add({ kind: 'mark', parent: list, layer: 'main', data: {}, pose: box(10, 180) });
    const dragged = scene.add({ kind: 'mark', parent: list, layer: 'main', data: {}, pose: box(10, 200) });
    scene.scroll.set(list, { x: 0, y: 150 });
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(400, 0, 200, 200) });
    const layouts = { [list]: stack, [target]: bin };

    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [dragged], layouts), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [dragged], layouts, DRAG));
    handle.onEnd!(ctx(scene, [dragged], layouts, DRAG), 'commit');

    expect(scene.get(dragged)!.parent).toBe(target);
    expect(scene.get(a)!.pose).toEqual(box(10, 160));
    expect(scene.get(b)!.pose).toEqual(box(10, 180));
  });
});
