/**
 * `GestureContext.frames`: what a behavior outside core has for frame math.
 * The scene's container pose is a frame, since under the identity default a
 * stored pose and a world pose are one value and nothing here could fail.
 */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { expectSamePose } from 'core/scene/frameFixture';
import type { NodeId, RectPose } from 'core/scene/types';
import type { MoveBehavior } from '../../gestures/types';
import { scenePoseFrame } from '../poseFrame';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const box = (x: number, y: number, w = 10, h = 10, rotation?: number): RectPose =>
  rotation === undefined ? { x, y, width: w, height: h } : { x, y, width: w, height: h, rotation };

function fixture(view?: unknown) {
  const scene = createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    composition: RIGID_POSE_COMPOSITION,
  });
  const c = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 200, 200, Math.PI / 2) });
  const s = scene.add({ kind: 'mark', parent: c, layer: 'main', data: {}, pose: box(10, 10) });
  const seen: { origin: RectPose; current: RectPose; back: RectPose; live: RectPose; plane: unknown }[] = [];
  const spy: MoveBehavior<RectPose> = {
    onMove: (ctx) => {
      const frames = ctx.frames!;
      const current = frames.toWorld(s, ctx.current.get(s)!);
      seen.push({
        origin: frames.toWorld(s, ctx.origin.get(s)!),
        current,
        back: frames.toLocal(s, current),
        live: frames.world(s),
        plane: frames.planeOf('main'),
      });
    },
  };
  const base = { world: { x: 0, y: 0 }, modifiers: MODS, deps: { selection: { get: () => [s] as NodeId[] }, scene, view } };
  const at = (x: number): InvocationCtx => ({
    ...base, world: { x, y: 0 }, drag: { start: { x: 0, y: 0 }, current: { x, y: 0 }, delta: { x, y: 0 } },
  }) as unknown as InvocationCtx;
  const start = () => (moveAction.invoker as OngoingInvoker)
    .start(base as unknown as InvocationCtx, { behaviors: [spy] } as BindingOpts) as OngoingHandle;
  return { scene, s, seen, at, start };
}

describe('GestureContext.frames', () => {
  it('composes a move\'s stored poses to world, inside a turned frame', () => {
    const f = fixture();
    const handle = f.start();
    handle.onMove!(f.at(100));
    const [frame] = f.seen;
    expectSamePose(frame!.origin, box(180, 10, 10, 10, Math.PI / 2));
    expectSamePose(frame!.current, box(280, 10, 10, 10, Math.PI / 2));
    // What the behavior computed is where the scene shows the node.
    expectSamePose(scenePoseFrame(f.scene as never).world(f.s) as RectPose, frame!.current);
  });

  it('takes a world pose back to the stored one, and reads the shown pose', () => {
    const f = fixture();
    const handle = f.start();
    handle.onMove!(f.at(100));
    handle.onMove!(f.at(150));
    const frame = f.seen[1]!;
    expectSamePose({ rotation: 0, ...frame.back }, { rotation: 0, ...(f.scene.overrides.get(f.s)!.pose as RectPose) });
    // `world` reads what the last frame published.
    expectSamePose(frame.live, box(280, 10, 10, 10, Math.PI / 2));
  });

  it('answers the plane a layer is stored in', () => {
    const plane = { scale: { x: 2, y: 2 }, offset: { x: 5, y: 0 } };
    const view = { get: () => null, planeOf: (layer: string) => (layer === 'main' ? plane : null) };
    const f = fixture(view);
    const handle = f.start();
    handle.onMove!(f.at(100));
    expect(f.seen[0]!.plane).toBe(plane);
  });
});
