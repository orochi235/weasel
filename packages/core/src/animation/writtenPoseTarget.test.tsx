import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { type Target } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { RECT_POSE_DESCRIPTOR } from '../core/geometry/poseDescriptor';
import { tweenPose, type PoseAnimationAdapter } from './poseHelpers';
import { createWrittenPoseTarget } from './writtenPoseTarget';

type Pose = { x: number; y: number; width: number; height: number };

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

const at = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });

/** One pose in a store the test owns, with no overrides table: the target is all that
 *  shows it moving. */
function setup() {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const store: { pose: Pose | undefined } = { pose: at(0) };
  let rests = 0;
  const write = (pose: Pose): void => { store.pose = pose; };
  const target = createWrittenPoseTarget<Pose>({
    read: () => store.pose,
    write,
    descriptor: RECT_POSE_DESCRIPTOR,
    onRest: () => { rests += 1; },
  })!;
  const adapter: PoseAnimationAdapter<Pose> = {
    getPose: () => store.pose!,
    setPose: (_id, pose) => write(pose),
    poseTarget: (): Target<Pose> => target,
  };
  return { clock, animator: result.current, adapter, store, x: () => store.pose!.x, rests: () => rests };
}

describe('createWrittenPoseTarget', () => {
  it('is null for a node the store does not hold', () => {
    expect(createWrittenPoseTarget<Pose>({
      read: () => undefined,
      write: () => {},
      descriptor: RECT_POSE_DESCRIPTOR,
    })).toBeNull();
  });

  it('adds a second tweenPose to the first', () => {
    const { clock, animator, adapter, x } = setup();
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 1000, easing: linear });
    clock.advance(0);
    clock.advance(500);
    expect(x()).toBeCloseTo(50, 6);
    tweenPose(animator, adapter, { id: 'a', to: at(200), ms: 1000, easing: linear });
    expect(x()).toBeCloseTo(50, 6);
    clock.advance(0);
    clock.advance(500);
    // The first has arrived at 100; the second is halfway through its own 100.
    expect(x()).toBeCloseTo(150, 6);
    clock.advance(500);
    clock.advance(16);
    expect(x()).toBe(200);
    expect(animator.isActive()).toBe(false);
  });

  it('leaves the store at the pose on screen when a move is canceled', () => {
    const { clock, animator, adapter, x } = setup();
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 1000, easing: linear });
    clock.advance(0);
    clock.advance(250);
    animator.cancelKey('pose:a');
    clock.advance(16);
    expect(x()).toBeCloseTo(25, 6);
  });

  it('reports each rest, a node gone from the store included', () => {
    const { clock, animator, adapter, store, rests } = setup();
    tweenPose(animator, adapter, { id: 'a', to: at(100), ms: 100, easing: linear, recordOp: false });
    store.pose = undefined;
    clock.advance(0);
    clock.advance(200);
    clock.advance(16);
    expect(rests()).toBeGreaterThan(0);
  });
});
