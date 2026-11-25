/**
 * A layout container scaled to nothing has no frame its strategy can see it
 * in: a drag out of it, or over it, goes on without its layout.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene, RIGID_POSE_COMPOSITION } from '@weasel-js/core/engine';
import type { NodeId, RectPose } from '@weasel-js/core';
import type { LayoutStrategy, PoseComposition } from '@weasel-js/core/engine';

/** Rigid, except that a frame with no width does not invert. */
const COLLAPSING: PoseComposition<RectPose> = {
  ...RIGID_POSE_COMPOSITION,
  decompose: (frame, p) => (frame.width === 0 ? null : RIGID_POSE_COMPOSITION.decompose(frame, p)),
};

const stack = {
  childPoses: () => new Map(),
  depart: () => ({ poses: new Map() }),
  releaseDrop: () => [],
} as unknown as LayoutStrategy<unknown>;

describe('moveAction — a singular layout container', () => {
  it('moves a child out of a collapsed container without asking its layout', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: COLLAPSING });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 0, height: 0, rotation: 0 } });
    const child = scene.add({ kind: 'mark', layer: 'main', parent: box, data: {}, pose: { x: 0, y: 0, width: 20, height: 10 } });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 110, y: 105 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        operands: { get: () => [child] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === box ? stack : null) },
      },
    };
    const drag = { start: { x: 110, y: 105 }, current: { x: 310, y: 305 }, delta: { x: 200, y: 200 } };
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, undefined);
    const end = { ...base, world: drag.current, drag } as unknown as InvocationCtx;
    expect(() => handle.onMove!(end)).not.toThrow();
    expect(() => handle.onEnd!(end, 'commit')).not.toThrow();
  });
});
