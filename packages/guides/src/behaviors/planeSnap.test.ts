/**
 * The snap behaviors on a parallax plane. The plane here zooms (factor 0
 * against a 2x camera), so a drag reaches it scaled as well as offset: a
 * grid or guide must be read where it lies in the camera's world, not the
 * plane's.
 */
import { describe, it, expect } from 'vitest';
import {
  asNodeId,
  createScene,
  moveAction,
  resizeAction,
  type Action,
  type BindingOpts,
  type InvocationCtx,
  type OngoingHandle,
  type OngoingInvoker,
  type RectPose,
  type Scene,
  type SelectionApi,
  type View,
  type ViewApi,
} from '@weasel-js/core';
import { snapToGrid } from './move/snapToGrid';
import { snapToGuides } from './move/snapToGuides';
import { pointSnapToGrid } from './resize/pointSnapToGrid';

// Camera panned to x=100 at 2x; the sky does not zoom and pans with it, so its
// world is the camera's doubled and shifted: plane = (2x - 100, 2y).
const CAMERA: View = { x: 100, y: 0, scale: { x: 2, y: 2 } };
const SKY = { pan: 1, zoom: 0 };

type S = Scene<unknown, string, unknown>;

function makeScene(): S {
  // `sun` is stored at (100,100) 40x40 in the sky, so it paints over camera
  // (100,50) 20x20.
  return createScene<unknown, 'sky' | 'main', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'sky', parallax: SKY }],
    initial: [
      { id: asNodeId('sun'), kind: 'leaf', layer: 'sky', pose: { x: 100, y: 100, width: 40, height: 40 }, data: {} },
    ],
  }) as unknown as S;
}

const viewDep = (): ViewApi => ({ get: () => CAMERA, set: () => {} });

function ctxOf(
  scene: S,
  start: { x: number; y: number },
  current: { x: number; y: number },
  extra: { deps?: Record<string, unknown>; affordance?: unknown } = {},
): InvocationCtx {
  return {
    world: current,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ['sun'], clear: () => {} } as unknown as SelectionApi,
      scene,
      view: viewDep(),
      ...extra.deps,
    },
    drag: {
      start,
      current,
      delta: { x: current.x - start.x, y: current.y - start.y },
      ...(extra.affordance ? { affordance: extra.affordance } : {}),
    },
  } as unknown as InvocationCtx;
}

function drag(
  action: Action,
  scene: S,
  from: { x: number; y: number },
  to: { x: number; y: number },
  extra: Parameters<typeof ctxOf>[3] = {},
  opts?: BindingOpts,
): OngoingHandle {
  const handle = (action.invoker as OngoingInvoker).start(ctxOf(scene, from, from, extra), opts);
  handle.onMove!(ctxOf(scene, from, to, extra));
  handle.onEnd!(ctxOf(scene, from, to, extra), 'commit');
  return handle;
}

const poseOf = (scene: S, id: string) => scene.get(asNodeId(id))!.pose as RectPose;

describe('snapping on a parallax plane', () => {
  it('snaps a move to the camera\'s grid where it lies in the plane', () => {
    const scene = makeScene();
    // 6 camera units is 12 in the sky: origin sky 112 is camera 106, which a
    // 10-unit camera grid rounds to 110 — sky 120.
    drag(moveAction, scene, { x: 110, y: 60 }, { x: 116, y: 60 }, {},
      { behaviors: [snapToGrid({ spacing: 10 })] });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 120, y: 100 });
  });

  it('snaps a move to a camera guide where it lies in the plane', () => {
    const scene = makeScene();
    // The guide at camera x=111 is sky 122. A 10.5-unit drag puts the origin
    // at sky 121, inside the 6px tolerance (6 sky units at the sky's 1x).
    drag(moveAction, scene, { x: 110, y: 60 }, { x: 120.5, y: 60 }, {},
      { behaviors: [snapToGuides({ getGuides: () => [{ id: 'g', axis: 'x', offset: 111 }] })] });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 122, y: 100 });
  });

  it('snaps a resize point to the camera\'s grid where it lies in the plane', () => {
    const scene = makeScene();
    // The corner lands at sky 166 (camera 133); a camera grid rounds it to
    // 130 — sky 160 — not the sky grid's 170.
    const resizePolicy = {
      constraints: [], expandIds: (ids: string[]) => ids,
      pointSnap: [pointSnapToGrid({ spacing: 10 })],
    };
    drag(resizeAction, scene, { x: 120, y: 70 }, { x: 133, y: 83 }, {
      deps: { resizePolicy },
      affordance: { kind: 'handle:bottom-right', targetIds: ['sun'], anchor: { x: 'min', y: 'min' } },
    });
    expect(poseOf(scene, 'sun')).toMatchObject({ x: 100, y: 100, width: 60, height: 60 });
  });
});
