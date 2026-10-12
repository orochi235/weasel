import { describe, expect, it } from 'vitest';
import { createTarget, type Target } from '../target';
import { skeletonAxes } from '../rig/skeletonAxes';
import { IDENTITY_JOINT, type Pose, type Skeleton } from '../rig/types';
import { sampleTrack } from './sampleTrack';
import type { Keyframe, SampledTrack } from './types';

const skeleton: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};
const TAU = Math.PI * 2;

function poseTarget(): Target<Pose> {
  let pose: Pose = {};
  return createTarget<Pose>({ get: () => pose, set: (p) => { pose = p; }, axes: skeletonAxes(skeleton) });
}

const track = (keys: Keyframe<Pose>[], more: Partial<SampledTrack<Pose>> = {}): SampledTrack<Pose> =>
  ({ kind: 'sampled', keys, target: poseTarget(), ...more });

describe('sampling a track with a target', () => {
  it('interpolates in the target\'s axes, with no interpolate of its own', () => {
    const t = track([
      { t: 0, value: { hip: { x: 0, rotation: 0 } } },
      { t: 100, value: { hip: { x: 10, rotation: 1 }, knee: { scaleX: 3 } } },
    ]);
    expect(sampleTrack(t, 50)).toEqual({
      hip: { x: 5, y: 0, rotation: 0.5, scaleX: 1, scaleY: 1 },
      knee: { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1 },
    });
  });

  it('answers a full value at a key, in the shape it answers between keys', () => {
    const t = track([
      { t: 0, value: { hip: { x: 4 } } },
      { t: 100, value: { hip: { x: 10 } } },
      { t: 200, value: {} },
    ]);
    const full = (x: number): Pose => ({
      hip: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      knee: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    });
    expect(sampleTrack(t, 0)).toEqual(full(4));
    expect(sampleTrack(t, 100)).toEqual(full(10));
    expect(sampleTrack(t, 200)).toEqual(full(0));
    expect(sampleTrack(t, -5)).toEqual(full(4));
    expect(sampleTrack(t, 500)).toEqual(full(0));
  });

  it('takes the short way round between neighboring keys on an angle axis', () => {
    const t = track([
      { t: 0, value: { hip: { rotation: 0.1 } } },
      { t: 100, value: { hip: { rotation: TAU - 0.1 } } },
      { t: 200, value: { hip: { rotation: 0.3 } } },
    ]);
    expect(sampleTrack(t, 50)!.hip!.rotation).toBeCloseTo(0, 9);
    // Each key carries on from the one before, so nothing jumps a turn at a key.
    expect(sampleTrack(t, 100)!.hip!.rotation).toBeCloseTo(-0.1, 9);
    expect(sampleTrack(t, 150)!.hip!.rotation).toBeCloseTo(0.1, 9);
    expect(sampleTrack(t, 200)!.hip!.rotation).toBeCloseTo(0.3, 9);
  });

  it('eases each segment with its key\'s easing', () => {
    const t = track([
      { t: 0, value: { hip: { x: 0 } } },
      { t: 100, value: { hip: { x: 10 } }, easing: (u) => u * u },
    ]);
    expect(sampleTrack(t, 50)!.hip!.x).toBeCloseTo(2.5, 9);
  });

  it('lets an explicit interpolate win', () => {
    const t = track(
      [{ t: 0, value: { hip: { x: 0 } } }, { t: 100, value: { hip: { x: 10 } } }],
      { interpolate: () => ({ hip: { x: 99 } }) },
    );
    expect(sampleTrack(t, 50)).toEqual({ hip: { x: 99 } });
  });

  it('refuses a key that is not the target\'s shape', () => {
    let v = { x: 0, y: 0 };
    const target = createTarget({ get: () => v, set: (n) => { v = n; } });
    const bad = { kind: 'sampled', keys: [{ t: 0, value: { x: 0, y: 0 } }, { t: 100, value: { x: 1 } }], target } as SampledTrack<{ x: number; y: number }>;
    expect(() => sampleTrack(bad, 50)).toThrow(/target's shape/);
  });

  it('still samples a numeric track on a default target as before', () => {
    let v = 0;
    const target = createTarget<number>({ get: () => v, set: (n) => { v = n; } });
    const t: SampledTrack<number> = { kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }], target };
    expect(sampleTrack(t, 0)).toBe(0);
    expect(sampleTrack(t, 25)).toBeCloseTo(25, 9);
    expect(sampleTrack(t, 100)).toBe(100);
  });
});
