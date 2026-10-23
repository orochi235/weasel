/**
 * A node whose pose is derived from other nodes cannot be moved itself: a pose
 * written to it is overwritten on the next read. Moving it moves what it
 * derives from.
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './action';
import { nudgeRightAction } from '../defaults/nudge';
import type { ImmediateInvoker, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import type { DerivedDep, NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/** The union of the dependencies' boxes. */
const around = (_n: unknown, deps: readonly (DerivedDep<RectPose> | undefined)[]): RectPose | null => {
  const ps = deps.filter((d) => d !== undefined).map((d) => d.pose);
  if (ps.length === 0) return null;
  const x = Math.min(...ps.map((p) => p.x));
  const y = Math.min(...ps.map((p) => p.y));
  return box(x, y, Math.max(...ps.map((p) => p.x + p.width)) - x, Math.max(...ps.map((p) => p.y + p.height)) - y);
};

/** `a` and `b` in an inner group, which with `c` makes an outer group. */
function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const leaf = (x: number) => scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(x, 0) });
  const a = leaf(0);
  const b = leaf(50);
  const c = leaf(200);
  const inner = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [a, b], derivePose: around as never,
  });
  const outer = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [inner, c], derivePose: around as never,
  });
  return { scene, a, b, c, inner, outer };
}

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

const DRAG = { start: { x: 5, y: 5 }, current: { x: 105, y: 5 }, delta: { x: 100, y: 0 } };
const at = (scene: S, id: NodeId) => effectivePose(scene, scene.get(id)!);

function drag(scene: S, ids: string[]): OngoingHandle {
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, ids), {}) as OngoingHandle;
  handle.onMove!(ctx(scene, ids, DRAG));
  return handle;
}

describe('moving a node whose pose is derived from others', () => {
  it('carries what it derives from, and so itself, through the drag', () => {
    const { scene, a, b, c, inner } = fixture();
    drag(scene, [inner]);
    expect(at(scene, a)).toEqual(box(100, 0));
    expect(at(scene, b)).toEqual(box(150, 0));
    expect(at(scene, inner)).toEqual(box(100, 0, 60, 10));
    expect(at(scene, c)).toEqual(box(200, 0));
  });

  it('commits the move to what it derives from, as one undo step', () => {
    const { scene, a, b, inner } = fixture();
    const depth = scene.historyIndex();
    drag(scene, [inner]).onEnd!(ctx(scene, [inner], DRAG), 'commit');
    expect(scene.get(a)!.pose).toEqual(box(100, 0));
    expect(scene.get(b)!.pose).toEqual(box(150, 0));
    expect(scene.get(inner)!.pose).toEqual(box(0, 0));
    expect(scene.historyIndex()).toBe(depth + 1);
    scene.undo();
    expect(at(scene, inner)).toEqual(box(0, 0, 60, 10));
  });

  it('reaches through a derived node that derives from another', () => {
    const { scene, a, b, c, outer } = fixture();
    drag(scene, [outer]).onEnd!(ctx(scene, [outer], DRAG), 'commit');
    expect(scene.get(a)!.pose).toEqual(box(100, 0));
    expect(scene.get(b)!.pose).toEqual(box(150, 0));
    expect(scene.get(c)!.pose).toEqual(box(300, 0));
  });

  it('moves a node once when it is selected beside the group that holds it', () => {
    const { scene, a, inner } = fixture();
    drag(scene, [inner, a]).onEnd!(ctx(scene, [inner, a], DRAG), 'commit');
    expect(scene.get(a)!.pose).toEqual(box(100, 0));
  });

  it('nudges what it derives from', () => {
    const { scene, a, b, inner } = fixture();
    (nudgeRightAction.invoker as ImmediateInvoker).run(
      { selection: { get: () => [inner] } as unknown as SelectionApi, scene } as never,
      { magnitude: 'small' } as never,
    );
    expect(scene.get(a)!.pose.x).toBeGreaterThan(0);
    expect(scene.get(b)!.pose.x - scene.get(a)!.pose.x).toBe(50);
    expect(scene.get(inner)!.pose).toEqual(box(0, 0));
  });
});
