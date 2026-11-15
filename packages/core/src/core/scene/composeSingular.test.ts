/**
 * A frame with no inverse: storing one is valid and its children compose flat, but no local pose under it
 * composes back to a world pose, so `decompose` answers `null` and a rebase into it fails.
 */
import { describe, expect, it } from 'vitest';
import type { PoseLinear } from '@weasel-js/geom';
import { composeRigidPose, decomposeRigidPose, frameInverts, rebaseLocalPose, RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import type { PoseAdapter } from 'core/scene/composePose';
import type { RectPose } from 'core/scene/types';

const box = (transform?: PoseLinear): RectPose => ({ x: 0, y: 0, width: 100, height: 100, ...(transform ? { transform } : {}) });
const WORLD: RectPose = { x: 100, y: 0, width: 10, height: 10 };

describe('decomposeRigidPose under a singular frame', () => {
  it.each<[string, PoseLinear]>([
    ['an x axis scaled to zero', [0, 0, 0, 1]],
    ['both axes scaled to zero', [0, 0, 0, 0]],
    ['a skew whose columns are parallel', [1, 2, 2, 4]],
    ['a near-singular scale past geom\'s conditioning bound', [1, 0, 0, 1e-13]],
  ])('answers null for %s', (_name, transform) => {
    expect(decomposeRigidPose(box(transform), WORLD)).toBeNull();
  });

  it('still composes a child under one, flat', () => {
    const flat = composeRigidPose(box([0, 0, 0, 1]), WORLD);
    expect(flat.transform).toEqual([0, 0, 0, 1]);
    expect(flat.x).toBe(45);
  });

  it('round-trips under a near-singular frame that still inverts', () => {
    const thin = box([1, 0, 0, 1e-6]);
    const local = decomposeRigidPose(thin, WORLD)!;
    const back = composeRigidPose(thin, local);
    expect(back.x).toBeCloseTo(WORLD.x, 6);
    expect(back.y).toBeCloseTo(WORLD.y, 6);
    expect(back.transform).toBeUndefined();
  });

  it('turns back a rotation alone, which always inverts', () => {
    const turned: RectPose = { ...box(), rotation: 1.2 };
    expect(decomposeRigidPose(turned, WORLD)).not.toBeNull();
  });
});

describe('rebaseLocalPose and frameInverts', () => {
  const poses: Record<string, { pose: RectPose; parent: string | null }> = {
    flat: { pose: box([0, 0, 0, 1]), parent: null },
    inner: { pose: { x: 10, y: 10, width: 20, height: 20 }, parent: 'flat' },
    plain: { pose: box(), parent: null },
  };
  const adapter: PoseAdapter<RectPose> = {
    getPose: (id) => poses[id]!.pose,
    getParent: (id) => poses[id]!.parent,
  };
  const { compose, decompose } = RIGID_POSE_COMPOSITION;

  it('refuses a rebase into a singular frame, and into one nested in it', () => {
    expect(rebaseLocalPose(adapter, WORLD, 'flat', compose, decompose)).toBeNull();
    expect(rebaseLocalPose(adapter, WORLD, 'inner', compose, decompose)).toBeNull();
    expect(rebaseLocalPose(adapter, WORLD, 'plain', compose, decompose)).toEqual(WORLD);
  });

  it('tells a singular frame from one that inverts', () => {
    expect(frameInverts(adapter, 'flat', RIGID_POSE_COMPOSITION)).toBe(false);
    expect(frameInverts(adapter, 'inner', RIGID_POSE_COMPOSITION)).toBe(false);
    expect(frameInverts(adapter, 'plain', RIGID_POSE_COMPOSITION)).toBe(true);
    expect(frameInverts(adapter, null, RIGID_POSE_COMPOSITION)).toBe(true);
  });
});
