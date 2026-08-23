// apps/site/demos/platformer/animState.ts
import { CLIPS, poseInterpolate, samplePose, type ClipName } from './clips';
import type { Pose } from '@weasel-js/core';
import { MAX_FALL, MOVE_SPEED } from './physics';

/** Cross-fade duration between clips, in milliseconds. */
export const FADE_MS = 120;

export interface AnimState {
  current: ClipName;
  /** The clip being faded out, or null once the fade completes. */
  previous: ClipName | null;
  /** 0 → all previous, 1 → all current. */
  fade: number;
  /** Playhead into `current`, in milliseconds. */
  phase: number;
  /** Playhead into `previous`, frozen at the moment of the switch. */
  previousPhase: number;
}

export interface AnimCtx {
  onGround: boolean;
  vx: number;
  vy: number;
  hurt: boolean;
}

export const createAnimState = (): AnimState => ({
  current: 'idle',
  previous: null,
  fade: 1,
  phase: 0,
  previousPhase: 0,
});

function pick(ctx: AnimCtx): ClipName {
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
    const u = 1 - Math.min(Math.abs(ctx.vy) / 470, 1);
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

export function nextAnimState(s: AnimState, ctx: AnimCtx, dt: number): AnimState {
  const want = pick(ctx);
  const switching = want !== s.current;

  const current = want;
  const previous = switching ? s.current : s.fade < 1 ? s.previous : null;
  const previousPhase = switching ? s.phase : s.previousPhase;
  const phase = advance(current, switching ? 0 : s.phase, ctx, dt);

  const fade = previous === null
    ? 1
    : Math.min((switching ? 0 : s.fade) + (dt * 1000) / FADE_MS, 1);

  return {
    current,
    previous: fade >= 1 ? null : previous,
    fade,
    phase,
    previousPhase,
  };
}

/** The pose the rig is drawn at: the outgoing clip blended into the incoming one. */
export function resolvePose(s: AnimState): Pose {
  const now = samplePose(CLIPS[s.current], s.phase);
  if (s.previous === null || s.fade >= 1) return now;
  return poseInterpolate(samplePose(CLIPS[s.previous], s.previousPhase), now, s.fade);
}
