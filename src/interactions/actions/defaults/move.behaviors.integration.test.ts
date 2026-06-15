import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import { snapToContainer } from '../move/behaviors/snapToContainer';
import { snapBackOrDelete } from '../move/behaviors/snapBackOrDelete';
import { snapToGrid } from '../move/behaviors/snapToGrid';
import type { InvocationCtx, BindingOpts, OngoingHandle, OngoingInvoker } from '../invoker';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { SnapTarget } from 'core/adapters/types';

interface D { color: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function stubSelection(ids: string[]): SelectionApi {
  return { get: () => ids } as unknown as SelectionApi;
}

function ctx(
  scene: ReturnType<typeof createScene<D, L, P>>,
  ids: string[],
  drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } },
): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: stubSelection(ids), scene },
    drag,
  } as unknown as InvocationCtx;
}

function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'container', layer: 'main', data: { color: '#eee' }, pose: { x: 200, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'leaf', layer: 'main', data: { color: '#f00' }, pose: { x: 0, y: 0, width: 20, height: 20 } });
  return { scene, box: box as string, leaf: leaf as string };
}

describe('moveAction behavior pipeline', () => {
  it('snapToContainer reparents the dragged node on commit', () => {
    const { scene, box, leaf } = fixture();
    const target: SnapTarget<P> = { parentId: box, slotPose: { x: 210, y: 10, width: 20, height: 20 } };
    const opts: BindingOpts = {
      behaviors: [
        snapToContainer<P>({
          dwellMs: 0,
          isInstant: () => true,
          findTarget: (_id, wx) => (wx > 200 ? target : null),
        }) as never,
      ],
    };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }), 'commit');
    expect(scene.get(asNodeId(leaf))?.parent).toBe(box);
    expect(scene.get(asNodeId(leaf))?.pose).toEqual({ x: 210, y: 10, width: 20, height: 20 });
  });

  it('snapBackOrDelete aborts (no pose change) within radius', () => {
    const { scene, leaf } = fixture();
    const before = scene.get(asNodeId(leaf))!.pose;
    const opts: BindingOpts = { behaviors: [snapBackOrDelete<P>({ radius: 100, onFreeRelease: 'snap-back' }) as never] };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 15, y: 12 }, delta: { x: 5, y: 2 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 15, y: 12 }, delta: { x: 5, y: 2 } }), 'commit');
    expect(scene.get(asNodeId(leaf))?.pose).toEqual(before);
  });

  it('snapToGrid quantizes the committed delta', () => {
    const { scene, leaf } = fixture();
    const opts: BindingOpts = { behaviors: [snapToGrid<P>({ spacing: 20 }) as never] };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 23, y: 19 }, delta: { x: 23, y: 19 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 23, y: 19 }, delta: { x: 23, y: 19 } }), 'commit');
    const pose = scene.get(asNodeId(leaf))!.pose;
    expect(pose.x % 20).toBe(0);
    expect(pose.y % 20).toBe(0);
  });

  it('empty behaviors = translate-only commit (default path)', () => {
    const { scene, leaf } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 30, y: 40 }, delta: { x: 30, y: 40 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 30, y: 40 }, delta: { x: 30, y: 40 } }), 'commit');
    expect(scene.get(asNodeId(leaf))?.pose).toEqual({ x: 30, y: 40, width: 20, height: 20 });
  });
});
