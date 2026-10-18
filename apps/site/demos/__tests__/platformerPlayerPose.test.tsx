// apps/site/demos/__tests__/platformerPlayerPose.test.tsx
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { bindClip, createTarget, skeletonAxes, sampleTrack } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import type { Pose, SampledTrack } from '@weasel-js/animator';
import { createScene } from '@weasel-js/core';
import { FADE_MS, createAnimState, nextAnimState, type AnimCtx, type AnimState } from '../platformer/animState';
import { CLIPS, type ClipName } from '../platformer/clips';
import { createPlayerPose } from '../platformer/playerPose';
import { PLAYER_SKELETON } from '../platformer/skeleton';

const RUNNING: AnimCtx = { onGround: true, vx: 150, vy: 0, hurt: false };
const RISING: AnimCtx = { onGround: false, vx: 0, vy: -300, hurt: false };
const DT = 1 / 60;

const scratch = createTarget<Pose>({ get: () => ({}), set: () => {}, axes: skeletonAxes(PLAYER_SKELETON) });
const clipAt = (name: ClipName, t: number): Pose =>
  sampleTrack(bindClip(CLIPS[name], { target: () => scratch, weight: () => () => 1 }).tracks[0] as SampledTrack<Pose>, t)!;

/** A player pose on an animator the test steps. `show` is one frame of the demo's loop: the
 *  animator's frame, then the state put on the target, as its `onTick` does. */
function setup() {
  let now = 0;
  const cbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const player = createPlayerPose(result.current, createScene({ systemLayers: [{ id: 'main' }] }));
  const show = (s: AnimState): Pose => {
    act(() => {
      now += DT * 1000;
      for (const cb of cbs.splice(0)) cb(now);
      player.sync(s);
    });
    return player.read();
  };
  return { player, show, animator: result.current };
}

const rotation = (pose: Pose, joint: string) => pose[joint]?.rotation ?? 0;

describe('createPlayerPose', () => {
  it('shows the clip in play, a frame after the state that asked for it', () => {
    const { show } = setup();
    let s = createAnimState();
    show(s);
    s = nextAnimState(s, { ...RUNNING, vx: 0 }, DT);
    const shown = show(s);
    // The frame sampled the state synced before it.
    expect(rotation(shown, 'thighL')).toBeCloseTo(rotation(clipAt('idle', 0), 'thighL'), 9);
    expect(rotation(show(s), 'armL')).toBeCloseTo(rotation(clipAt('idle', s.phase), 'armL'), 9);
  });

  it('fades a new clip in over the pose that was on screen, reaching the clip after FADE_MS', () => {
    const { show } = setup();
    let s = createAnimState();
    show(s);
    const idle = show(s);
    s = nextAnimState(s, RUNNING, DT);
    show(s);
    const first = show(s);
    // One step in, the run clip weighs `fade` against the idle pose it took over from.
    const run = clipAt('run', s.phase);
    expect(rotation(first, 'thighL')).toBeCloseTo(
      rotation(idle, 'thighL') + (rotation(run, 'thighL') - rotation(idle, 'thighL')) * s.fade, 9,
    );
    for (let i = 0; i < Math.ceil(FADE_MS / 1000 / DT) + 1; i++) {
      s = nextAnimState(s, RUNNING, DT);
      show(s);
    }
    expect(s.fade).toBe(1);
    expect(rotation(show(s), 'thighL')).toBeCloseTo(rotation(clipAt('run', s.phase), 'thighL'), 9);
  });

  it('does not pop when a clip switches again before the previous fade finishes', () => {
    const { show } = setup();
    let s = createAnimState();
    show(s);
    show(s);
    // idle -> run, one tick in: the fade is well under 1 when the next switch happens.
    s = nextAnimState(s, RUNNING, DT);
    show(s);
    const before = show(s);
    s = nextAnimState(s, RISING, DT);
    show(s);
    const after = show(s);
    // torso and foreL tell idle, run and jump apart sharply enough to catch a pop, but one
    // step of a blend moves them only a little.
    expect(Math.abs(rotation(after, 'torso') - rotation(before, 'torso'))).toBeLessThan(0.02);
    expect(Math.abs(rotation(after, 'foreL') - rotation(before, 'foreL'))).toBeLessThan(0.02);
    expect(Math.abs(rotation(after, 'thighL') - rotation(before, 'thighL'))).toBeGreaterThan(0);
  });

  it('keeps one timeline on the animator however many switches there were', () => {
    const { show, animator, player } = setup();
    let s = createAnimState();
    for (const ctx of [RUNNING, RISING, RUNNING, RISING]) {
      s = nextAnimState(s, ctx, DT);
      show(s);
    }
    expect(animator.live().map((a) => [a.kind, a.label])).toEqual([['timeline', 'jump']]);
    act(() => { player.dispose(); });
    expect(animator.live()).toEqual([]);
  });

  it('holds the last key of a clip that has played out', () => {
    const { show } = setup();
    let s = createAnimState();
    const POLE: AnimCtx = { onGround: false, vx: 0, vy: 0, hurt: false, onPole: true };
    for (let i = 0; i < 80; i++) {
      s = nextAnimState(s, POLE, DT);
      show(s);
    }
    expect(s.phase).toBe(CLIPS.pole.duration);
    expect(rotation(show(s), 'torso')).toBeCloseTo(0.22, 9);
  });
});
