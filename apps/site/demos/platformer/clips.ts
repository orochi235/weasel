// apps/site/demos/platformer/clips.ts
import { blendPoses, easeInOutSine, sampleTrack } from '@weasel-js/core';
import type { Keyframe, Pose, SampledTrack } from '@weasel-js/core';

/** Blending two poses IS interpolating between them — the rig needs no
 *  timeline integration of its own beyond this one line. */
export const poseInterpolate = (a: Pose, b: Pose, u: number): Pose => blendPoses([a, b], [1 - u, u]);

export interface Clip {
  /** Milliseconds. */
  duration: number;
  keys: Keyframe<Pose>[];
}

const clip = (duration: number, keys: Keyframe<Pose>[]): Clip => ({ duration, keys });

/** Arms and legs swung to one side; `s` flips the whole thing for the other half
 *  of the cycle, which is what makes one authored key serve both footfalls. */
const stride = (s: 1 | -1, lift: number): Pose => ({
  hip: { y: lift },
  torso: { rotation: -0.08 * s },
  thighL: { rotation: 0.5 * s },
  shinL: { rotation: s > 0 ? 0.15 : 0.7 },
  thighR: { rotation: -0.5 * s },
  shinR: { rotation: s > 0 ? 0.7 : 0.15 },
  armL: { rotation: -0.6 * s },
  foreL: { rotation: -0.3 },
  armR: { rotation: 0.6 * s },
  foreR: { rotation: 0.3 },
});

const NEUTRAL: Pose = {
  hip: { y: 0 },
  torso: { rotation: 0 },
  thighL: { rotation: 0.08 },
  shinL: { rotation: -0.03 },
  thighR: { rotation: -0.08 },
  shinR: { rotation: 0.03 },
  armL: { rotation: 0 },
  foreL: { rotation: 0 },
  armR: { rotation: 0 },
  foreR: { rotation: 0 },
};

/**
 * One full run cycle is two footfalls. The mirrored keys at 0 and half-duration
 * are the contacts; the passing poses between them carry the body's rise.
 */
export const RUN = clip(500, [
  { t: 0, value: stride(1, 0) },
  { t: 125, value: stride(1, -2), easing: easeInOutSine },
  { t: 250, value: stride(-1, 0), easing: easeInOutSine },
  { t: 375, value: stride(-1, -2), easing: easeInOutSine },
  { t: 500, value: stride(1, 0), easing: easeInOutSine },
]);

export const IDLE = clip(1600, [
  { t: 0, value: NEUTRAL },
  {
    t: 800,
    value: { ...NEUTRAL, hip: { y: 1 }, torso: { rotation: 0.04 }, armL: { rotation: 0.08 }, armR: { rotation: -0.08 } },
    easing: easeInOutSine,
  },
  { t: 1600, value: NEUTRAL, easing: easeInOutSine },
]);

/** Seeked by vertical velocity rather than played: t = 0 is the launch, t =
 *  duration is the apex. */
export const JUMP = clip(300, [
  { t: 0, value: { ...NEUTRAL, hip: { y: 2 }, thighL: { rotation: 0.7 }, shinL: { rotation: -0.9 }, thighR: { rotation: 0.5 }, shinR: { rotation: -0.6 } } },
  { t: 300, value: { ...NEUTRAL, hip: { y: -2 }, armL: { rotation: -0.9 }, armR: { rotation: 0.9 }, thighL: { rotation: -0.3 }, thighR: { rotation: 0.2 }, shinR: { rotation: 0.4 } }, easing: easeInOutSine },
]);

/** Also seeked: t = 0 at the apex, t = duration at terminal velocity. */
export const FALL = clip(300, [
  { t: 0, value: { ...NEUTRAL, armL: { rotation: -0.9 }, armR: { rotation: 0.9 }, thighL: { rotation: -0.3 }, thighR: { rotation: 0.2 } } },
  { t: 300, value: { ...NEUTRAL, armL: { rotation: -1.6 }, armR: { rotation: 1.6 }, thighL: { rotation: 0.4 }, shinL: { rotation: -0.5 }, thighR: { rotation: -0.2 } }, easing: easeInOutSine },
]);

export const HURT = clip(400, [
  { t: 0, value: { ...NEUTRAL, torso: { rotation: 0.5 }, armL: { rotation: -1.4 }, armR: { rotation: 1.4 }, hip: { y: -3 } } },
  { t: 400, value: NEUTRAL, easing: easeInOutSine },
]);

export const CLIPS = { idle: IDLE, run: RUN, jump: JUMP, fall: FALL, hurt: HURT } as const;
export type ClipName = keyof typeof CLIPS;

/** `sampleTrack` wants a whole track, and rebuilding one per call would throw
 *  away its segment cache — so each clip gets one track and one cache, made once. */
const TRACKS = new WeakMap<Clip, { track: SampledTrack<Pose>; cache: Map<number, (u: number) => Pose> }>();

function trackFor(c: Clip) {
  let entry = TRACKS.get(c);
  if (!entry) {
    entry = {
      track: { kind: 'sampled', keys: c.keys, interpolate: poseInterpolate, onTick: () => {} },
      cache: new Map(),
    };
    TRACKS.set(c, entry);
  }
  return entry;
}

/** Sample a clip at `t` milliseconds, clamped to the clip's range. */
export function samplePose(c: Clip, t: number): Pose {
  const { track, cache } = trackFor(c);
  const clamped = Math.min(Math.max(t, 0), c.duration);
  return sampleTrack(track, clamped, cache) ?? {};
}
