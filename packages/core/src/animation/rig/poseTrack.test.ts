import { describe, expect, it } from 'vitest';
import { createTarget } from '../target';
import { createTimeline, type TimelineRegister } from '../timeline/createTimeline';
import type { SampledTrack } from '../timeline/types';
import { poseAxes } from './poseAxes';
import { resolveSkeleton } from './resolveSkeleton';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, timeScale: () => 1, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const skeleton: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};

/** A pose target nothing reads: the track's own `onTick` is what these tests watch. */
const target = createTarget<Pose>({ get: () => ({}), set: () => {}, axes: poseAxes(skeleton) });
const hold = () => ({ touch: () => {}, leave: () => {} });

describe('animating a rig is an ordinary sampled track', () => {
  it('interpolates poses in the target\'s axes, with no interpolate', () => {
    const h = harness();
    let latest: Pose = {};
    const track: SampledTrack<Pose> = {
      kind: 'sampled',
      label: 'walk',
      keys: [
        { t: 0, value: { hip: { rotation: 0 } } },
        { t: 100, value: { hip: { rotation: 1 } } },
      ],
      target,
      onTick: (p) => { latest = p; },
    };
    createTimeline(h.register, 1, { tracks: [track] }, undefined, hold);

    h.advance(50);
    expect(latest.hip!.rotation).toBeCloseTo(0.5, 6);
  });

  it('feeds resolveSkeleton to drive joint world transforms over time', () => {
    const h = harness();
    let latest: Pose = {};
    const track: SampledTrack<Pose> = {
      kind: 'sampled',
      keys: [
        { t: 0, value: { hip: { rotation: 0 } } },
        { t: 100, value: { hip: { rotation: Math.PI / 2 } } },
      ],
      target,
      onTick: (p) => { latest = p; },
    };
    createTimeline(h.register, 1, { tracks: [track] }, undefined, hold);

    h.advance(100);
    const world = resolveSkeleton(skeleton, latest);
    const m = world.get('knee')!;
    expect(m[6]).toBeCloseTo(0, 5);
    expect(m[7]).toBeCloseTo(10, 5);
  });
});
