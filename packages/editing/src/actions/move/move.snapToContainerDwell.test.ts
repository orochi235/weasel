/** A dwell elapsing while the pointer is held still shows the snap at once, and the release lands where it shows. */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { moveAction } from './action';
import { snapToContainer } from './behaviors/snapToContainer';
import type { BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { RectPose } from '@weasel-js/core/engine';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });
const DRAG = { start: { x: 5, y: 5 }, current: { x: 260, y: 10 }, delta: { x: 255, y: 5 } };

function ctx(scene: S, ids: string[], drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { operands: { get: () => ids } as unknown as SelectionApi, scene },
    drag,
  } as unknown as InvocationCtx;
}

afterEach(() => { vi.useRealTimers(); });

describe('moveAction with snapToContainer, held still past the dwell', () => {
  it('shows the nodes in their slot and says so, before any further move', () => {
    vi.useFakeTimers();
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(200, 0, 200, 200) });
    const leaf = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const opts: BindingOptions = {
      behaviors: [
        snapToContainer<RectPose>({
          dwellMs: 300,
          findTarget: (_id, wx) => (wx > 200 ? { parentId: target, slotPose: box(210, 10) } : null),
        }) as never,
      ],
    };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), opts) as OngoingHandle;
    const changed = vi.fn();
    handle.subscribe?.(changed);
    handle.onMove!(ctx(scene, [leaf], DRAG));
    expect(scene.overrides.read(leaf)?.pose).toEqual(box(255, 5));
    vi.advanceTimersByTime(300);
    expect(changed).toHaveBeenCalled();
    expect(scene.overrides.read(leaf)?.pose).toEqual(box(210, 10));
    handle.onEnd!(ctx(scene, [leaf], DRAG), 'commit');
    expect(scene.get(leaf)!.parent).toBe(target);
  });
});

describe('moveAction with two snapToContainer behaviors on one binding', () => {
  it('lets one dwell finish while the other finds no target', () => {
    vi.useFakeTimers();
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(200, 0, 200, 200) });
    const leaf = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const opts: BindingOptions = {
      behaviors: [
        snapToContainer<RectPose>({
          dwellMs: 300,
          findTarget: (_id, wx) => (wx > 200 ? { parentId: target, slotPose: box(210, 10) } : null),
        }) as never,
        snapToContainer<RectPose>({ dwellMs: 800, findTarget: () => null }) as never,
      ],
    };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], DRAG));
    handle.onMove!(ctx(scene, [leaf], DRAG));
    vi.advanceTimersByTime(300);
    expect(scene.overrides.read(leaf)?.pose).toEqual(box(210, 10));
    handle.onEnd!(ctx(scene, [leaf], DRAG), 'commit');
    expect(scene.get(leaf)!.parent).toBe(target);
  });
});

describe('moveAction with snapToContainer, a group and its own child both dragged', () => {
  it('plants the group and leaves the child inside it', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const target = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(200, 0, 200, 200) });
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 40, 40) });
    const child = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: box(5, 5) });
    const opts: BindingOptions = {
      behaviors: [
        snapToContainer<RectPose>({
          dwellMs: 300,
          isInstant: () => true,
          findTarget: (_id, wx) => (wx > 200 ? { parentId: target, slotPose: box(210, 10, 40, 40) } : null),
        }) as never,
      ],
    };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [group, child]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [group, child], DRAG));
    handle.onEnd!(ctx(scene, [group, child], DRAG), 'commit');
    expect(scene.get(group)!.parent).toBe(target);
    expect(scene.get(child)!.parent).toBe(group);
  });
});
