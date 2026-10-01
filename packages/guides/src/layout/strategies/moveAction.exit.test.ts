/**
 * A child dragged out of its layout container and released where no container
 * takes it leaves that container: it lands under the plain container beneath
 * the drop, or at the top level, rather than staying a child drawn clipped to
 * a container it no longer sits in.
 */
import { describe, expect, it } from 'vitest';
import {
  composeRectPose,
  createScene,
  decomposeRectPose,
  moveAction,
  type InvocationCtx,
  type LayoutDep,
  type NodeId,
  type OngoingHandle,
  type OngoingInvoker,
  type RectPose,
} from '@weasel-js/core';
import { freeform } from './freeform';
import { snapPoint } from './snapPoint';

const box = (x: number, y: number, w = 20, h = 20): RectPose => ({ x, y, width: w, height: h });

function setup() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const C = scene.add({
    kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 100, 100),
    layout: freeform<RectPose>(),
  });
  const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, parent: C, pose: box(10, 10) });
  return { scene, C, a };
}

/** Drag `ids` from (20, 20) by (dx, dy) and release. */
function drag(
  scene: ReturnType<typeof setup>['scene'],
  ids: NodeId[],
  dx: number,
  dy: number,
  local = false,
): void {
  const layout: LayoutDep = { getLayout: (id) => scene.layoutOf(id as NodeId) as never };
  const deps: Record<string, unknown> = { selection: { get: () => ids }, scene, layout };
  if (local) deps.poseComposition = { compose: composeRectPose, decompose: decomposeRectPose };
  const ctx = (moved: boolean): InvocationCtx => ({
    world: { x: 20 + (moved ? dx : 0), y: 20 + (moved ? dy : 0) },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    drag: moved
      ? { start: { x: 20, y: 20 }, current: { x: 20 + dx, y: 20 + dy }, delta: { x: dx, y: dy } }
      : undefined,
  }) as unknown as InvocationCtx;
  const h = (moveAction.invoker as OngoingInvoker).start(ctx(false), {}) as OngoingHandle;
  h.onMove!(ctx(true));
  h.onEnd!(ctx(true), 'commit');
}

describe('moveAction: dropping a child outside its layout container', () => {
  it('lifts it to the top level when nothing is under the drop', () => {
    const { scene, a } = setup();
    drag(scene, [a], 300, 0);
    expect(scene.get(a)!.parent).toBeNull();
    expect(scene.get(a)!.pose).toEqual(box(310, 10));
  });

  it('undoes the lift and the move as one step', () => {
    const { scene, C, a } = setup();
    drag(scene, [a], 300, 0);
    scene.undo();
    expect(scene.get(a)!.parent).toBe(C);
    expect(scene.get(a)!.pose).toEqual(box(10, 10));
  });

  it('keeps the world position under a local pose model', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const C = scene.add({
      kind: 'container', layer: 'main', data: {}, pose: box(50, 50, 100, 100),
      layout: freeform<RectPose>(),
    });
    // Local to C: world (60, 60).
    const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, parent: C, pose: box(10, 10) });
    drag(scene, [a], 300, 0, true);
    expect(scene.get(a)!.parent).toBeNull();
    expect(scene.get(a)!.pose).toEqual(box(360, 60));
  });

  it('lands it in a plain container under the drop', () => {
    const { scene, a } = setup();
    const P = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(250, 0, 100, 100) });
    drag(scene, [a], 300, 0);
    expect(scene.get(a)!.parent).toBe(P);
  });

  it('stays in its container when released inside it', () => {
    const { scene, C, a } = setup();
    drag(scene, [a], 40, 40);
    expect(scene.get(a)!.parent).toBe(C);
    expect(scene.get(a)!.pose).toEqual(box(50, 50));
  });

  it('stays in its container when its own layout has no slot for it there', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const S = scene.add({
      kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 100, 100),
      layout: snapPoint<RectPose>({ pattern: 'corners' }),
    });
    const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, parent: S, pose: box(0, 0) });
    drag(scene, [a], 30, 30);
    expect(scene.get(a)!.parent).toBe(S);
  });
});
