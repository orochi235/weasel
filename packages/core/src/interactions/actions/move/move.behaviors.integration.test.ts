import { heldPose } from '../testUtils';
import { describe, it, expect } from 'vitest';
import { moveAction } from './action';
import { snapToContainer } from './behaviors/snapToContainer';
import { snapBackOrDelete } from './behaviors/snapBackOrDelete';
import type { MoveBehavior } from '../../gestures/types';
import type { InvocationCtx, BindingOpts, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { SnapTarget } from 'core/adapters/types';

/** A behavior that rounds the first dragged origin to a 20-unit lattice. */
const grid20 = (): MoveBehavior<{ x: number; y: number }> => ({
  onMove(ctx, t) {
    const o = ctx.origin.get(ctx.draggedIds[0]!);
    if (t.kind !== 'translate' || !o) return;
    const round = (v: number) => Math.round(v / 20) * 20;
    return { transform: { kind: 'translate', dx: round(o.x + t.dx) - o.x, dy: round(o.y + t.dy) - o.y } };
  },
});

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
  const box = scene.add({ kind: 'group', layer: 'main', data: { color: '#eee' }, pose: { x: 200, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'mark', layer: 'main', data: { color: '#f00' }, pose: { x: 0, y: 0, width: 20, height: 20 } });
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

  it('snapToContainer previews every dragged node in its own slot, and commits it there', () => {
    const { scene, box, leaf } = fixture();
    const second = scene.add({ kind: 'mark', layer: 'main', data: { color: '#00f' }, pose: { x: 0, y: 60, width: 20, height: 20 } }) as string;
    const slots: Record<string, P> = {
      [leaf]: { x: 210, y: 10, width: 20, height: 20 },
      [second]: { x: 240, y: 10, width: 20, height: 20 },
    };
    const opts: BindingOpts = {
      behaviors: [
        snapToContainer<P>({
          dwellMs: 0,
          isInstant: () => true,
          findTarget: (id, wx) => (wx > 200 ? { parentId: box, slotPose: slots[id] } : null),
        }) as never,
      ],
    };
    const drag = { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leaf, second]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf, second], drag));
    expect(heldPose(scene, leaf)).toEqual(slots[leaf]);
    expect(heldPose(scene, second)).toEqual(slots[second]);
    handle.onEnd!(ctx(scene, [leaf, second], drag), 'commit');
    for (const id of [leaf, second]) {
      expect(scene.get(asNodeId(id))?.parent).toBe(box);
      expect(scene.get(asNodeId(id))?.pose).toEqual(slots[id]);
    }
  });

  it('carries a dragged container\'s children to where a behavior lands it', () => {
    const { scene, box } = fixture();
    const group = scene.add({ kind: 'group', layer: 'main', data: { color: '#ccc' }, pose: { x: 0, y: 0, width: 100, height: 100 } }) as string;
    const child = scene.add({ kind: 'mark', layer: 'main', parent: asNodeId(group), data: { color: '#0f0' }, pose: { x: 10, y: 10, width: 20, height: 20 } }) as string;
    const target: SnapTarget<P> = { parentId: box, slotPose: { x: 210, y: 30, width: 100, height: 100 } };
    const opts: BindingOpts = {
      behaviors: [
        snapToContainer<P>({ dwellMs: 0, isInstant: () => true, findTarget: (_id, wx) => (wx > 200 ? target : null) }) as never,
      ],
    };
    const drag = { start: { x: 5, y: 5 }, current: { x: 260, y: 10 }, delta: { x: 255, y: 5 } };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [group]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [group], drag));
    handle.onEnd!(ctx(scene, [group], drag), 'commit');
    expect(scene.get(asNodeId(group))?.pose).toEqual(target.slotPose);
    // The group landed (210, 30) from where it started, not the drag's (255, 5).
    expect(scene.get(asNodeId(child))?.pose).toEqual({ x: 220, y: 40, width: 20, height: 20 });
    expect(scene.get(asNodeId(child))?.parent).toBe(group);
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

  it('a grid snap quantizes the committed delta', () => {
    const { scene, leaf } = fixture();
    const opts: BindingOpts = { behaviors: [grid20() as never] };
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

  it('multi-behavior ordering: first-defer second-claim — snapToContainer wins over a grid snap', () => {
    // The grid snap only implements onMove (no onEnd) → returns undefined at
    // onEnd → defers. snapToContainer returns Op[] at onEnd → claims the
    // commit. The container snap should win regardless of ordering.
    const { scene, box, leaf } = fixture();
    const target: SnapTarget<P> = { parentId: box, slotPose: { x: 210, y: 10, width: 20, height: 20 } };
    const opts: BindingOpts = {
      behaviors: [
        grid20() as never,
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
    // snapToContainer's onEnd claimed the commit → reparented + slot pose applied.
    expect(scene.get(asNodeId(leaf))?.parent).toBe(box);
    expect(scene.get(asNodeId(leaf))?.pose).toEqual({ x: 210, y: 10, width: 20, height: 20 });
  });

  it('multi-select uniform translate: both leaves move by the same delta (no drift)', () => {
    // GroupTransform headline invariant: when multiple nodes are selected,
    // every node translates by the same (dx, dy). Their relative offset
    // must be preserved after the commit.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const leafA = scene.add({ kind: 'mark', layer: 'main', data: { color: '#f00' }, pose: { x: 0, y: 0, width: 20, height: 20 } }) as string;
    const leafB = scene.add({ kind: 'mark', layer: 'main', data: { color: '#00f' }, pose: { x: 100, y: 50, width: 20, height: 20 } }) as string;
    const poseABefore = { ...scene.get(asNodeId(leafA))!.pose };
    const poseBBefore = { ...scene.get(asNodeId(leafB))!.pose };

    const opts: BindingOpts = { behaviors: [grid20() as never] };
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [leafA, leafB]), opts) as OngoingHandle;
    const delta = { x: 40, y: 60 };
    handle.onMove!(ctx(scene, [leafA, leafB], { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta }));
    handle.onEnd!(ctx(scene, [leafA, leafB], { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta }), 'commit');

    const poseA = scene.get(asNodeId(leafA))!.pose;
    const poseB = scene.get(asNodeId(leafB))!.pose;
    // Both must have moved by the same delta — their relative offset is preserved.
    expect(poseA.x - poseABefore.x).toBe(poseB.x - poseBBefore.x);
    expect(poseA.y - poseABefore.y).toBe(poseB.y - poseBBefore.y);
    // Both moved by a non-zero amount (grid-snapped, but still a real move).
    expect(poseA.x).not.toBe(poseABefore.x);
    expect(poseB.x).not.toBe(poseBBefore.x);
  });

  it('cancel path bypasses behaviors: pose and parent unchanged', () => {
    // onEnd('cancel') returns before the behavior pipeline → behaviors never
    // fire and the scene is left exactly as at drag start.
    const { scene, box, leaf } = fixture();
    const poseBefore = { ...scene.get(asNodeId(leaf))!.pose };
    const parentBefore = scene.get(asNodeId(leaf))!.parent;
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
    // Move over the container so the snap is committed in behavior scratch.
    handle.onMove!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }));
    // Cancel instead of commit — behaviors must NOT fire.
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }), 'cancel');
    expect(scene.get(asNodeId(leaf))?.pose).toEqual(poseBefore);
    expect(scene.get(asNodeId(leaf))?.parent).toBe(parentBefore);
  });
});
