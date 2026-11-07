/**
 * The page's hold on a render worker's animator. Each call is queued and goes with the next
 * frame, after the scene changes that frame carries, so a program plays on the scene the page
 * showed when it asked.
 */
import type { AnimationOp } from './protocol';

/** One animation a worker program started, steered from the page. */
export interface WorkerAnimationHandle {
  readonly id: number;
  cancel(): void;
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
}

/** The worker's animator as the page reaches it. The programs are the worker module's, registered
 *  with `serveSceneRender({ animations })`; keys are the ones those programs give what they start. */
export interface WorkerAnimator {
  /** Run the program registered as `program`, handing it `params`, which cross as data. */
  play(program: string, params?: unknown): WorkerAnimationHandle;
  cancelKey(key: string): void;
  pauseKey(key: string): void;
  resumeKey(key: string): void;
  cancelAll(): void;
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
}

/** A {@link WorkerAnimator} whose calls go to `queue`. */
export function workerAnimator(queue: (op: AnimationOp) => void): WorkerAnimator {
  let next = 0;
  return {
    play(key, params) {
      const id = ++next;
      queue({ op: 'play', id, key, ...(params !== undefined ? { params } : {}) });
      return {
        id,
        cancel: () => queue({ op: 'cancel', id }),
        pause: () => queue({ op: 'pause', id }),
        resume: () => queue({ op: 'resume', id }),
        setTimeScale: (scale) => queue({ op: 'scale', id, scale }),
      };
    },
    cancelKey: (key) => queue({ op: 'cancelKey', key }),
    pauseKey: (key) => queue({ op: 'pauseKey', key }),
    resumeKey: (key) => queue({ op: 'resumeKey', key }),
    cancelAll: () => queue({ op: 'cancelAll' }),
    pause: () => queue({ op: 'pauseAll' }),
    resume: () => queue({ op: 'resumeAll' }),
    setTimeScale: (scale) => queue({ op: 'scaleAll', scale }),
  };
}
