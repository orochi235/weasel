/**
 * A move behavior that claims the commit can ask the action for its default
 * translate of the roots it did not place itself (`MoveEnd.translateOps`).
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './action';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { MoveBehavior, MoveEnd } from '../../gestures/types';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

const DRAG = { start: { x: 5, y: 5 }, current: { x: 105, y: 5 }, delta: { x: 100, y: 0 } };

function ctx(scene: S, ids: string[], drag?: typeof DRAG): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => ids } as unknown as SelectionApi, scene },
    drag,
  } as unknown as InvocationCtx;
}

/** Two leaves and a container holding a third. */
function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
  const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 100, 60, 60) });
  const child = scene.add({ kind: 'mark', parent: group, layer: 'main', data: {}, pose: box(10, 110) });
  return { scene, a, b, group, child };
}

/** Drag `ids` by `DRAG` and commit, with `onEnd` deciding the commit. */
function commit(scene: S, ids: NodeId[], onEnd: (end: MoveEnd) => Op[], shape?: MoveBehavior<unknown>): void {
  const claims: MoveBehavior<unknown> = { onEnd: (_ctx, end) => onEnd(end) };
  const opts: BindingOpts = { behaviors: (shape ? [shape, claims] : [claims]) as never };
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, ids), opts) as OngoingHandle;
  handle.onMove!(ctx(scene, ids, DRAG));
  handle.onEnd!(ctx(scene, ids, DRAG), 'commit');
}

describe('MoveEnd.translateOps', () => {
  it('translates the roots a behavior names, beside the ones it placed itself', () => {
    const { scene, a, b } = fixture();
    commit(scene, [a, b], (end) => [
      createTransformOp<RectPose>({ id: a, from: box(0, 0), to: box(7, 7), label: 'Place' }),
      ...end.translateOps([b]),
    ]);
    expect(scene.get(a)!.pose).toEqual(box(7, 7));
    expect(scene.get(b)!.pose).toEqual(box(150, 0));
  });

  it('translates by the drag as the behaviors shaped it', () => {
    const { scene, a, b } = fixture();
    const halve: MoveBehavior<unknown> = {
      onMove: (_ctx, t) => (t.kind === 'translate' ? { transform: { kind: 'translate', dx: t.dx / 2, dy: t.dy } } : undefined),
    };
    commit(scene, [a, b], (end) => end.translateOps([b]), halve);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.get(b)!.pose).toEqual(box(100, 0));
  });

  it('takes the descendants that follow a named root, and no other root', () => {
    const { scene, b, group, child } = fixture();
    commit(scene, [b, group], (end) => end.translateOps([group]));
    expect(scene.get(group)!.pose).toEqual(box(100, 100, 60, 60));
    expect(scene.get(child)!.pose).toEqual(box(110, 110));
    expect(scene.get(b)!.pose).toEqual(box(50, 0));
  });

  it('ignores an id that is not a dragged root', () => {
    const { scene, a, b, group, child } = fixture();
    let ops: Op[] | null = null;
    commit(scene, [a, group], (end) => (ops = end.translateOps([child, b, 'nowhere'])));
    expect(ops).toEqual([]);
    expect(scene.get(child)!.pose).toEqual(box(10, 110));
    expect(scene.get(b)!.pose).toEqual(box(50, 0));
  });
});
