/**
 * A dragged node `snapToContainer` has no slot for is committed by the
 * action's own translate, which writes a derived node's authored pose rather
 * than the derivation it was captured at.
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './action';
import { snapToContainer } from './behaviors/snapToContainer';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import { unionOfChildren } from 'core/scene/kitRegistry';
import type { RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

const DRAG = { start: { x: 5, y: 5 }, current: { x: 260, y: 10 }, delta: { x: 255, y: 5 } };

function ctx(scene: S, ids: string[], drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => ids } as unknown as SelectionApi, scene },
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction with snapToContainer — a derived node with no slot of its own', () => {
  it('lands with the drop, and undo restores its authored pose', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(200, 0, 200, 200) });
    const leaf = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    // Authored at a placeholder; drawn as the union of its children.
    const envelope = scene.add({
      kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 1, 1),
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    const inside = scene.add({ kind: 'mark', parent: envelope, layer: 'main', data: {}, pose: box(10, 60) });
    const opts: BindingOpts = {
      behaviors: [
        snapToContainer<RectPose>({
          dwellMs: 0,
          isInstant: () => true,
          findTarget: (id, wx) => (id === leaf && wx > 200 ? { parentId: target, slotPose: box(210, 10) } : null),
        }) as never,
      ],
    };
    const ids = [leaf, envelope];
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, ids), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, ids, DRAG));
    handle.onEnd!(ctx(scene, ids, DRAG), 'commit');

    // The leaf took its slot, (210, 10) from where it started; the envelope rode along.
    expect(scene.get(leaf)!.pose).toEqual(box(210, 10));
    expect(scene.get(envelope)!.parent).toBe(target);
    expect(effectivePose(scene, scene.get(envelope)!)).toEqual(box(220, 70));
    expect(scene.get(inside)!.pose).toEqual(box(220, 70));

    scene.undo();
    expect(scene.get(envelope)!.pose).toEqual(box(0, 0, 1, 1));
    expect(scene.get(inside)!.pose).toEqual(box(10, 60));
  });
});
