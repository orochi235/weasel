// apps/site/demos/platformer/animState.ts
import { CLIPS, poseInterpolate, samplePose, type ClipName } from './clips';
import type { Pose } from '@weasel-js/core';
import { JUMP_SPEED, MAX_FALL, MOVE_SPEED } from './physics';

/** Cross-fade duration between clips, in milliseconds. */
export const FADE_MS = 120;

export interface AnimState {
  current: ClipName;
  /** The pose on screen at the moment of the last switch, frozen while it fades out. */
  outgoing: Pose | null;
  /** 0 → all outgoing, 1 → all current. */
  fade: number;
  /** Playhead into `current`, in milliseconds. */
  phase: number;
}

export interface AnimCtx {
  onGround: boolean;
  vx: number;
  vy: number;
  hurt: boolean;
  /** Riding the flagpole — outranks every other state. */
  onPole?: boolean;
}

export const createAnimState = (): AnimState => ({
  current: 'idle',
  outgoing: null,
  fade: 1,
  phase: 0,
});

function pick(ctx: AnimCtx): ClipName {
  if (ctx.onPole) return 'pole';
  if (ctx.hurt) return 'hurt';
  if (!ctx.onGround) return ctx.vy < 0 ? 'jump' : 'fall';
  return Math.abs(ctx.vx) > 1 ? 'run' : 'idle';
}

/**
 * Airborne clips are seeked by velocity, not played: the jump clip runs from
 * launch to apex as upward speed bleeds off, and the fall clip runs from apex to
 * terminal velocity. Grounded clips advance on the clock, with the run cycle's
 * rate tied to ground speed so the feet keep up with the ground.
 */
function advance(name: ClipName, prevPhase: number, ctx: AnimCtx, dt: number): number {
  const clip = CLIPS[name];
  if (name === 'jump') {
    const u = 1 - Math.min(Math.abs(ctx.vy) / JUMP_SPEED, 1);
    return u * clip.duration;
  }
  if (name === 'fall') {
    const u = Math.min(Math.max(ctx.vy, 0) / MAX_FALL, 1);
    return u * clip.duration;
  }
  const rate = name === 'run' ? Math.max(Math.abs(ctx.vx) / MOVE_SPEED, 0.15) : 1;
  const next = prevPhase + dt * 1000 * rate;
  return name === 'run' || name === 'idle' ? next % clip.duration : Math.min(next, clip.duration);
}

/**
 * A switch snapshots `resolvePose(s)` — the mixture actually on screen, however
 * many prior clips contributed to it — rather than remembering a second clip
 * identity. That is what keeps a second switch mid-fade from popping: the
 * frozen snapshot already carries whatever the eye was seeing.
 */
export function nextAnimState(s: AnimState, ctx: AnimCtx, dt: number): AnimState {
  const want = pick(ctx);
  const switching = want !== s.current;

  const current = want;
  const outgoing = switching ? resolvePose(s) : s.fade < 1 ? s.outgoing : null;
  const phase = advance(current, switching ? 0 : s.phase, ctx, dt);

  const fade = outgoing === null
    ? 1
    : Math.min((switching ? 0 : s.fade) + (dt * 1000) / FADE_MS, 1);

  return {
    current,
    outgoing: fade >= 1 ? null : outgoing,
    fade,
    phase,
  };
}

/** The pose the rig is drawn at: the outgoing snapshot blended into the current clip. */
export function resolvePose(s: AnimState): Pose {
  const now = samplePose(CLIPS[s.current], s.phase);
  if (s.outgoing === null || s.fade >= 1) return now;
  return poseInterpolate(s.outgoing, now, s.fade);
}
