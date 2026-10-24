/**
 * A move whose transform follower previews another node's pose and data, with
 * the gesture's previews published to the scene (`publishPreviews`): the move's
 * own hold poses the follower and the published preview shows its data, so what
 * derives from the follower follows every frame.
 */
import { describe, expect, it } from 'vitest';
import type { ActionDeps, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { publishPreviews } from 'canvas/publishPreviews';
import { effectivePose } from 'core/scene/effectivePose';
import { nodeAsShown } from 'core/scene/nodeAsShown';
import { createScene } from 'core/scene/scene';
import type { DerivedDep, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { moveAction } from './move/action';
import type { TransformFollower } from './transformFinish';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

function fixture() {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: { at: 0 }, pose: box(50, 0) });
  // Sits under the follower, at the height its data names.
  const under = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [b],
    derivePose: (_node, deps) => {
      const dep = deps[0] as DerivedDep<RectPose> | undefined;
      return dep === undefined ? null : box(dep.pose.x, (dep.node.data as { at: number }).at);
    },
  });
  const follower: TransformFollower = {
    finish: (ops) => [...ops],
    preview: (frame) => {
      const moved = frame.get(a) as RectPose | undefined;
      return moved === undefined ? [] : [{ id: b, pose: box(50 + moved.x, 0), data: { at: moved.x } }];
    },
  };
  const deps = {
    selection: { get: () => [a], adapterMethods: undefined } as unknown as SelectionApi,
    scene,
    transformFollowers: [follower],
  } as unknown as ActionDeps;
  const handles = new Set<OngoingHandle>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const fn of listeners) fn(); };
  const stop = publishPreviews(scene, {
    getInFlightHandles: () => handles.values(),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  const ctx = (dx: number) => ({
    world: { x: 5 + dx, y: 5 }, screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    drag: dx === 0 ? undefined : { start: { x: 5, y: 5 }, current: { x: 5 + dx, y: 5 }, delta: { x: dx, y: 0 } },
  }) as unknown as InvocationCtx;
  const press = (): { to(dx: number): void; end(reason: 'commit' | 'cancel', dx: number): void } => {
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(0), undefined) as OngoingHandle;
    handles.add(handle);
    return {
      to(dx) {
        handle.onMove!(ctx(dx));
        notify();
      },
      end(reason, dx) {
        handle.onEnd!(ctx(dx), reason);
        handles.delete(handle);
        notify();
      },
    };
  };
  return { scene, a, b, under, press, stop };
}

describe('a move previewing a transform follower\'s data', () => {
  it('shows the follower at the pose the move holds and the data its preview publishes, every frame', () => {
    const { scene, b, under, press } = fixture();
    const drag = press();
    for (const dx of [100, 150, 120]) {
      drag.to(dx);
      expect(scene.overrides.read(b)?.pose).toEqual(box(50 + dx, 0));
      expect(nodeAsShown(scene.overrides, scene.get(b)!).data).toEqual({ at: dx });
      expect(effectivePose(scene, scene.get(under)!)).toEqual(box(50 + dx, dx));
    }
    drag.end('cancel', 120);
    expect(scene.overrides.has(b)).toBe(false);
    expect(effectivePose(scene, scene.get(under)!)).toEqual(box(50, 0));
  });
});
