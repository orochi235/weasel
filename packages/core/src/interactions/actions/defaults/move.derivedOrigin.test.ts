/**
 * A container drag must capture a derived child at the pose it is painted at.
 *
 * The move action snapshots every dragged id and descendant at drag start, and
 * the preview, the behaviors and the commit all measure against that snapshot.
 * A derived child captured at its authored placeholder previews from there —
 * the override wins over the derivation, so it jumps to placeholder + delta.
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function ctx(
  scene: S,
  ids: string[],
  drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } },
): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => ids } as unknown as SelectionApi, scene },
    drag,
  } as unknown as InvocationCtx;
}

/** A container holding a leaf and a child that derives its pose 30 to the
 *  leaf's right, authored at a placeholder nowhere near there. */
function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const c = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 200, 200) });
  const s = scene.add({ kind: 'leaf', parent: c, layer: 'main', data: {}, pose: box(10, 10) });
  const d = scene.add({
    kind: 'leaf',
    parent: c,
    layer: 'main',
    data: {},
    pose: box(0, 0, 5, 5),
    dependsOn: [s],
    derivePose: (_n, deps) => {
      const p = deps[0]?.pose;
      return p ? box(p.x + 30, p.y) : null;
    },
  });
  return { scene, c: c as string, d: d as NodeId };
}

const DRAG = { start: { x: 50, y: 50 }, current: { x: 150, y: 50 }, delta: { x: 100, y: 0 } };

const poseOf = (scene: S, id: NodeId) => effectivePose(scene, scene.get(id)!);

describe('moveAction — a derived child inside a dragged container', () => {
  it('previews at its derived pose plus the delta, not its placeholder plus the delta', () => {
    const { scene, c, d } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [c]), {}) as OngoingHandle;

    handle.onMove!(ctx(scene, [c], DRAG));

    expect(poseOf(scene, d)).toEqual(box(140, 10));
    expect(handle.previewPose!(d as string)).toEqual(box(140, 10));
  });

  it('lands where the preview showed it', () => {
    const { scene, c, d } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [c]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [c], DRAG));

    handle.onEnd!(ctx(scene, [c], DRAG), 'commit');

    expect(poseOf(scene, d)).toEqual(box(140, 10));
  });

  it('commits the authored placeholder by the delta, so undo restores it exactly', () => {
    const { scene, c, d } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [c]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [c], DRAG));
    handle.onEnd!(ctx(scene, [c], DRAG), 'commit');

    expect(scene.get(d)!.pose).toEqual(box(100, 0, 5, 5));
    scene.undo();
    expect(scene.get(d)!.pose).toEqual(box(0, 0, 5, 5));
    expect(poseOf(scene, d)).toEqual(box(40, 10));
  });
});
