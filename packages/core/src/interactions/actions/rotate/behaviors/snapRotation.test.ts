import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import type { NodeId } from 'core/scene/types';
import type { RotateBehavior, RotatedPose } from '../../../gestures/types';
import { stubDeps } from '../../testUtils';
import { rotateAction } from '../action';
import { snapRotationWithModifier } from './snapRotation';

const DEG = Math.PI / 180;
/** A 50x50 square centered on (125, 75). */
const SQUARE = { x: 100, y: 50, width: 50, height: 50, rotation: 0 };
const CENTER = { x: 125, y: 75 };

function stubScene(initial: Record<string, RotatedPose>) {
  const poses = new Map<string, unknown>(Object.entries(initial));
  return {
    poses,
    overrides: createPoseOverrides<unknown>((id: string) => (poses.has(id) ? {} : undefined)),
    composition: IDENTITY_POSE_COMPOSITION,
    get: (id: NodeId) => (poses.has(id)
      ? { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null }
      : undefined),
    applyBatch(ops: unknown[]) {
      const adapter = { setPose: (id: string, pose: unknown) => { poses.set(id, pose); } };
      for (const op of ops as Array<{ apply(a: unknown): void }>) op.apply(adapter);
    },
  };
}

/** The pointer at `degrees` around the square's center, clockwise from its right. */
function pointerAt(degrees: number, shift: boolean, scene: ReturnType<typeof stubScene>, ids: string[]): InvocationCtx {
  return {
    world: { x: CENTER.x + 100 * Math.cos(degrees * DEG), y: CENTER.y + 100 * Math.sin(degrees * DEG) },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift },
    deps: stubDeps({ selection: { get: () => ids as NodeId[] }, scene }),
  } as InvocationCtx;
}

/** Rotate `initial`'s nodes by dragging the pointer `degrees` around the center, and commit. */
function rotateBy(
  degrees: number,
  opts: { shift?: boolean; behaviors?: RotateBehavior<RotatedPose>[]; initial?: Record<string, RotatedPose> } = {},
): Record<string, number> {
  const initial = opts.initial ?? { a: SQUARE };
  const scene = stubScene(initial);
  const ids = Object.keys(initial);
  const shift = opts.shift ?? false;
  if (rotateAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = rotateAction.invoker.start(
    pointerAt(0, shift, scene, ids),
    opts.behaviors ? { behaviors: opts.behaviors as never } : undefined,
  );
  handle.onMove!(pointerAt(degrees, shift, scene, ids));
  handle.onEnd!(pointerAt(degrees, shift, scene, ids), 'commit');
  return Object.fromEntries(ids.map((id) => [id, (scene.poses.get(id) as RotatedPose).rotation / DEG]));
}

describe('rotating with Shift held', () => {
  it('snaps the angle to 15 degree steps by default', () => {
    expect(rotateBy(22, { shift: true }).a).toBeCloseTo(15);
    expect(rotateBy(23, { shift: true }).a).toBeCloseTo(30);
    expect(rotateBy(-50, { shift: true }).a).toBeCloseTo(-45);
  });

  it('leaves the angle free without Shift', () => {
    expect(rotateBy(22).a).toBeCloseTo(22);
  });

  it('snaps the angle the node ends at, not the amount turned', () => {
    const initial = { a: { ...SQUARE, rotation: 10 * DEG } };
    expect(rotateBy(22, { shift: true, initial }).a).toBeCloseTo(30);
  });

  it('turns every node of a multi-selection by the snapped amount', () => {
    const initial = { a: SQUARE, b: { ...SQUARE, rotation: 5 * DEG } };
    const turned = rotateBy(22, { shift: true, initial });
    expect(turned.a).toBeCloseTo(15);
    expect(turned.b).toBeCloseTo(20);
  });

  it('is off for a rotate given an empty behaviors list', () => {
    expect(rotateBy(22, { shift: true, behaviors: [] }).a).toBeCloseTo(22);
  });
});

describe('snapRotationWithModifier', () => {
  it('takes its step and its key', () => {
    const behaviors = [snapRotationWithModifier<RotatedPose>({ step: Math.PI / 2, key: 'alt' })];
    expect(rotateBy(50, { shift: true, behaviors }).a).toBeCloseTo(50);
  });

  it('snaps on every move with no key', () => {
    const behaviors = [snapRotationWithModifier<RotatedPose>({ step: Math.PI / 2, key: null })];
    expect(rotateBy(50, { behaviors }).a).toBeCloseTo(90);
  });
});
