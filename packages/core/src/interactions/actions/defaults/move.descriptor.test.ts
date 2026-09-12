import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx, BindingOpts } from '../invoker';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/geometry/circlePose.fixture';

type S = Scene<object, 'main', CirclePose>;

function circleScene(): S {
  return createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
}

function drag(
  scene: S,
  ids: string[],
  delta: { x: number; y: number },
  deps: Record<string, unknown> = {},
  opts?: BindingOpts,
): void {
  const invoker = moveAction.invoker;
  if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const base = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ids as NodeId[] },
      scene: scene as Scene<unknown, string, unknown>,
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
      ...deps,
    },
  };
  const d = { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta };
  const handle = invoker.start(base as InvocationCtx, opts);
  handle.onMove!({ ...base, drag: d } as InvocationCtx);
  handle.onEnd!({ ...base, world: d.current, drag: d } as InvocationCtx, 'commit');
}

describe('moveAction — non-rect poses through the descriptor', () => {
  it('translates a circle without writing rect fields', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(10, 10, 5), data: {} });
    drag(scene, [id], { x: 20, y: 0 });
    expect(scene.get(id)!.pose).toEqual(circle(30, 10, 5));
  });

  it('drops a circle into a container without NaN', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(0, 0, 5), data: {} });
    const box = scene.add({ kind: 'container', layer: 'main', pose: circle(100, 100, 50), data: {} });
    drag(scene, [id], { x: 100, y: 100 }, { nodeAtPoint: () => box }, { params: { reparentOnDrop: 'top' } });
    expect(scene.get(id)!.parent).toBe(box);
    expect(scene.get(id)!.pose).toEqual(circle(100, 100, 5));
  });

  it('finds a layout container under a dragged circle and probes at the pointer', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(0, 0, 5), data: {} });
    const box = scene.add({ kind: 'container', layer: 'main', pose: circle(100, 100, 50), data: {} });
    const probes: { x: number; y: number }[] = [];
    const layout = {
      snap: { pickTarget: (t: unknown[], p: { x: number; y: number }) => { probes.push(p); return t[0] ?? null; } },
      childPoses: () => new Map(),
      getDropTargets: (_c: unknown, _k: unknown, dragged: { pose: unknown }) =>
        [{ pose: dragged.pose, origin: { x: 0, y: 0 } }],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    } as unknown as LayoutStrategy<unknown>;
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [id] as NodeId[] },
        scene: scene as Scene<unknown, string, unknown>,
        poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
        layout: { getLayout: (cid: string) => (cid === box ? layout : null) },
      },
    };
    const handle = invoker.start(base as InvocationCtx, undefined);
    handle.onMove!({
      ...base,
      drag: { start: { x: 0, y: 0 }, current: { x: 100, y: 100 }, delta: { x: 100, y: 100 } },
    } as InvocationCtx);
    expect(probes).toEqual([{ x: 100, y: 100 }]);
  });
});
