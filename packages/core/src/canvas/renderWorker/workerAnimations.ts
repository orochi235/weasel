/**
 * The animator a render worker runs. An animation is code, so it crosses the way a node function
 * does: the worker module registers each program under a key, and the page plays it by that key.
 * Its time comes from the page with each frame, so it moves only while the page's frame loop runs.
 */
import { hostAnimator, type AnimationHandle, type Animator } from '@weasel-js/animator';
import type { Scene } from '../../core/scene/types';
import type { AnimationOp, FrameTime } from './protocol';

/** What a worker animation is handed: the worker's animator, the worker's copy of the scene,
 *  and the `params` the page played it with. */
export interface WorkerAnimationContext {
  animator: Animator;
  scene: Scene<unknown, string, unknown>;
  params: unknown;
}

/** One program the page can play by its key. Return the handle of what it started, so the page
 *  can cancel, pause or rescale it; a program that starts several returns the one to steer, or
 *  none, and the page steers them by the keys it gave them. */
export type WorkerAnimation = (ctx: WorkerAnimationContext) => AnimationHandle | void;

export interface WorkerAnimations {
  /** The paint overrides the walk lays over the nodes. */
  readonly animator: Animator;
  /** Take the frame's time, before anything plays at it. */
  at(time: FrameTime | undefined, resumed: boolean): void;
  run(ops: readonly AnimationOp[], scene: Scene<unknown, string, unknown>): void;
  /** Advance to the frame's time. */
  advance(): void;
}

export function createWorkerAnimations(
  programs: Readonly<Record<string, WorkerAnimation>>,
  requestFrame: () => void,
): WorkerAnimations {
  let now = 0;
  let clock: { elapsed: number; rate: number } | null = null;
  let following = false;
  // On a clock, the clock's next move brings the next frame: one asked for inside a follow would
  // only ask again at the same time.
  const hosted = hostAnimator({ now: () => now, requestFrame: () => { if (!following) requestFrame(); } });
  const { animator } = hosted;
  const handles = new Map<number, AnimationHandle>();
  const one = (id: number, fn: (h: AnimationHandle) => void) => {
    const h = handles.get(id);
    if (h) fn(h);
  };
  const apply = (op: AnimationOp, scene: Scene<unknown, string, unknown>): void => {
    switch (op.op) {
      case 'play': {
        const program = programs[op.key];
        if (!program) throw new Error(`weasel render worker: no animation registered as "${op.key}"`);
        const handle = program({ animator, scene, params: op.params });
        if (handle) handles.set(op.id, handle);
        return;
      }
      case 'cancel': one(op.id, (h) => h.cancel()); handles.delete(op.id); return;
      case 'pause': one(op.id, (h) => h.pause()); return;
      case 'resume': one(op.id, (h) => h.resume()); return;
      case 'scale': one(op.id, (h) => h.setTimeScale(op.scale)); return;
      case 'cancelKey': animator.cancelKey(op.key); return;
      case 'pauseKey': animator.pauseKey(op.key); return;
      case 'resumeKey': animator.resumeKey(op.key); return;
      case 'cancelAll': animator.cancelAll(); handles.clear(); return;
      case 'pauseAll': animator.pause(); return;
      case 'resumeAll': animator.resume(); return;
      case 'scaleAll': animator.setTimeScale(op.scale);
    }
  };
  return {
    animator,
    at(time, resumed) {
      if (time && 'time' in time) {
        now = time.time;
        clock = null;
      } else if (time) {
        now = time.elapsed;
        clock = time;
      }
      if (resumed) hosted.resumed();
    },
    run(ops, scene) {
      for (const op of ops) apply(op, scene);
    },
    advance() {
      if (!clock) return hosted.tick(now);
      following = true;
      try { hosted.follow(clock.elapsed, clock.rate); } finally { following = false; }
    },
  };
}
