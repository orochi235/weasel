// apps/site/demos/platformer/animState.ts
import { CLIPS, type ClipName } from './clips';
import { JUMP_SPEED, MAX_FALL, MOVE_SPEED } from './physics';

/** Cross-fade duration between clips, in milliseconds. */
export const FADE_MS = 120;

export interface AnimState {
  current: ClipName;
  /** How many times the clip has changed, so a change away and back between two reads shows. */
  switches: number;
  /** `current`'s weight over what was on screen when it took over: 0 at the switch, 1 once
   *  faded in. */
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

export const createAnimState = (): AnimState => ({ current: 'idle', switches: 0, fade: 1, phase: 0 });

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

/** One step of the state machine. What the fade blends from is not kept here: it is whatever
 *  pose is on screen at the switch, which the pose target holds (`playerPose.ts`). */
export function nextAnimState(s: AnimState, ctx: AnimCtx, dt: number): AnimState {
  const current = pick(ctx);
  const switching = current !== s.current;
  return {
    current,
    switches: s.switches + (switching ? 1 : 0),
    fade: Math.min((switching ? 0 : s.fade) + (dt * 1000) / FADE_MS, 1),
    phase: advance(current, switching ? 0 : s.phase, ctx, dt),
  };
}
