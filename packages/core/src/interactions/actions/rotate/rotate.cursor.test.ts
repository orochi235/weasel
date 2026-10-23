import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import type { InvocationCtx } from '@weasel-js/routing';
import { describe, expect, it } from 'vitest';
import { stubDeps } from '../testUtils';
import { rotateAction } from './action';

// One 100×100 node centered on (50, 50), under a view of the given scale.
function startAt(world: { x: number; y: number }, scale = { x: 1, y: 1 }) {
  const pose = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
  const scene = {
    overrides: createPoseOverrides<unknown>(() => ({})),
    composition: IDENTITY_POSE_COMPOSITION,
    layers: [],
    get: () => ({ pose, kind: 'mark' as const, layer: 'main', data: {}, parent: null }),
    childrenOf: () => [],
    applyBatch: () => {},
  };
  const view = { get: () => ({ x: 0, y: 0, scale }), set: () => {} };
  const ctx = (at: { x: number; y: number }): InvocationCtx => ({
    world: at,
    screen: at,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({ selection: { get: () => ['a'] }, scene, view }),
  });
  if (rotateAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = rotateAction.invoker.start(ctx(world), undefined);
  return { handle, move: (x: number, y: number) => handle.onMove!(ctx({ x, y })) };
}

describe('the rotate cursor while dragging', () => {
  it('opens toward the pivot from where the drag starts', () => {
    const { handle } = startAt({ x: 50, y: -20 });
    expect(handle.cursor?.()).toMatchObject({ glyph: 'rotate', angle: 0 });
  });

  it('follows the pointer around the pivot', () => {
    const { handle, move } = startAt({ x: 50, y: -20 });
    move(120, 50);
    expect(handle.cursor?.()).toMatchObject({ angle: Math.PI / 2 });
    move(50, 120);
    expect(handle.cursor?.()).toMatchObject({ angle: Math.PI });
  });

  it('measures the turn on screen', () => {
    const { handle } = startAt({ x: 50, y: 120 }, { x: 1, y: -1 });
    expect(handle.cursor?.()).toMatchObject({ angle: 0 });
  });
});
