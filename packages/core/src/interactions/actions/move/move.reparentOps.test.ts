/**
 * Reparent-on-drop commits as ops: through the consumer's `applyOps` when one
 * is wired, and landing nothing when the container refuses the arrival.
 */
import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };

const refusing: LayoutStrategy<RectPose> = {
  snap: { pickTarget: () => null },
  childPoses: () => new Map(),
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
  arrive: () => null,
};

function makeScene(layout?: LayoutStrategy<RectPose>): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.add({
    id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 },
    ...(layout ? { layout } : {}),
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function drop(
  scene: Scene<unknown, string, unknown>,
  params: Record<string, unknown>,
  deps: Record<string, unknown> = {},
  ids: NodeId[] = [A],
): void {
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    {
      world: { x: 5, y: 5 },
      modifiers: MODS,
      deps: { selection: { get: () => ids }, scene, nodeAtPoint: () => T, ...deps },
    } as unknown as InvocationCtx,
    { params: { reparentOnDrop: 'top', ...params } },
  );
  const at = { start: { x: 5, y: 5 }, current: { x: 55, y: 5 }, delta: { x: 50, y: 0 } };
  handle.onMove!({ world: { x: 55, y: 5 }, modifiers: MODS, deps: {}, drag: at } as unknown as InvocationCtx);
  handle.onEnd!({ world: { x: 55, y: 5 }, modifiers: MODS, deps: {}, drag: at } as unknown as InvocationCtx, 'commit');
}

describe('moveAction — reparentOnDrop commits as ops', () => {
  it('hands the reparent to the consumer applyOps hook', () => {
    const scene = makeScene();
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();
    drop(scene, {}, { applyOps });
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0][0].map((op) => op.name)).toEqual(['reparent', 'transform']);
    expect(scene.get(A)!.parent).toBe(null);
  });

  it('undoes a reparent in one step', () => {
    const scene = makeScene();
    drop(scene, {});
    expect(scene.get(A)!.parent).toBe(T);
    scene.undo();
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('lands nothing and reports no commit when the container refuses', () => {
    const scene = makeScene(refusing);
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd });
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('does the same when the move is transient', () => {
    const scene = makeScene(refusing);
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd, transient: true });
    expect(scene.get(A)!.parent).toBe(null);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('reports no commit for a refused transient move though a consumer applyOps is wired', () => {
    const scene = makeScene(refusing);
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd, transient: true }, { applyOps: vi.fn() });
    expect(scene.get(A)!.parent).toBe(null);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('reports no commit when a refusal reverts a root that was already in the container', () => {
    const B = asNodeId('b');
    const refusesB: LayoutStrategy<RectPose> = {
      ...refusing,
      arrive: (_container, _children, arrivals) => (arrivals.has('b') ? null : { poses: new Map() }),
    };
    const scene = makeScene(refusesB);
    scene.move(A, T);
    scene.add({ id: B, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 20, width: 10, height: 10 } });
    const before = scene.get(A)!.pose;
    const onGestureEnd = vi.fn();
    drop(scene, { onGestureEnd }, {}, [A, B]);
    expect(scene.get(B)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(before);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
