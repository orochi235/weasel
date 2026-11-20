import type { AnimationHandle } from '@weasel-js/animator';
import { after } from '@weasel-js/registry';
import { interruptNode, trackItem, untrackItem } from './liveTransitions';
import type { TweenJob } from './transitionTweens';

/** What each item of one transition has running: its tweens, its pending delay, and its live-item entry. */
export interface ItemRuns {
  /** Run `fn` after `ms`, unless item `i` is stopped first. */
  wait(i: number, ms: number, fn: () => void): void;
  /**
   * After `delayMs`, unless `canceled()` by then, build item `i`'s jobs with `prepare` (null: it
   * has gone), interrupt other chains on its node and start them, calling `onDone` once every
   * one has finished, or at once with none. A job stopped short of its
   * end from outside (`animator.cancelKey`, `cancelAll`, a tick that threw) stops the item
   * through `stops[i]`, as an interrupt, since that job will never finish.
   */
  launch(
    i: number, prepare: () => readonly TweenJob[] | null, delayMs: number, canceled: () => boolean, onDone: () => void,
  ): void;
  /** Register item `i` as running on its node, under the chain `root()` names. */
  track(i: number): void;
  untrack(i: number): void;
  /** Cancel item `i`'s delay and tweens, and untrack it. */
  stop(i: number): void;
}

/**
 * Item runs for a transition whose item `i` tweens under `keys[i]`, and stops
 * through `stops[i]` when another chain reaches its node.
 */
export function createItemRuns(
  animator: object,
  keys: readonly string[],
  stops: readonly (() => void)[],
  root: () => object,
): ItemRuns {
  /** Each item's running tweens; `gone` once the animator has stopped one itself. */
  const handles = new Map<number, Array<{ handle: AnimationHandle | null; gone: boolean }>>();
  const pendingDelays = new Map<number, () => void>();
  const untrack = (i: number): void => untrackItem(animator, keys[i], stops[i]);
  const runs: ItemRuns = {
    wait(i, ms, fn) {
      pendingDelays.set(i, after(ms, () => {
        pendingDelays.delete(i);
        fn();
      }));
    },
    launch(i, prepare, delayMs, canceled, onDone) {
      const spawn = (): void => {
        if (canceled()) return;
        const jobs = prepare();
        if (!jobs) return;
        let jobsLeft = jobs.length;
        const jobDone = (): void => {
          if (--jobsLeft === 0) onDone();
        };
        interruptNode(animator, keys[i], root());
        const list = handles.get(i) ?? [];
        handles.set(i, list);
        for (const job of jobs) {
          const run: { handle: AnimationHandle | null; gone: boolean } = { handle: null, gone: false };
          list.push(run);
          // A finished tween stays on the animator's table until its frame is done, so a chained
          // one starting from this `onDone` under the same key retires it, as a cancel: gone first.
          run.handle = job(() => {
            run.gone = true;
            jobDone();
          }, () => {
            if (run.gone) return;
            // Marked first: the stop below cancels this item's handles, and this one is already off the table.
            run.gone = true;
            stops[i]();
          });
          // Stopped while this one started: it may have missed that stop's cancel, and the rest never start.
          if (handles.get(i) !== list) {
            run.handle.cancel();
            break;
          }
        }
        if (jobs.length === 0) onDone();
      };
      if (delayMs > 0) runs.wait(i, delayMs, spawn);
      else spawn();
    },
    track: (i) => trackItem(animator, keys[i], stops[i], root()),
    untrack,
    stop(i) {
      pendingDelays.get(i)?.();
      pendingDelays.delete(i);
      const list = handles.get(i) ?? [];
      handles.delete(i);
      for (const run of list) {
        if (!run.gone) {
          run.gone = true;
          run.handle?.cancel();
        }
      }
      untrack(i);
    },
  };
  return runs;
}
