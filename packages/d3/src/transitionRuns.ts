import type { AnimationHandle } from '@weasel-js/animator';
import { after } from '@weasel-js/registry';
import { interruptNode, trackItem, untrackItem } from './liveTransitions';
import type { TweenJob } from './transitionTweens';

/** What each item of one transition has running: its tweens, its pending delay, and its live-item entry. */
export interface ItemRuns {
  add(i: number, handle: AnimationHandle): void;
  /** Run `fn` after `ms`, unless item `i` is stopped first. */
  wait(i: number, ms: number, fn: () => void): void;
  /**
   * After `delayMs`, unless `canceled()` by then, interrupt other chains on item `i`'s node and
   * start its `jobs`, calling `onDone` once every one has finished.
   */
  launch(i: number, jobs: readonly TweenJob[], delayMs: number, canceled: () => boolean, onDone: () => void): void;
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
  const handles = new Map<number, AnimationHandle[]>();
  const pendingDelays = new Map<number, () => void>();
  const untrack = (i: number): void => untrackItem(animator, keys[i], stops[i]);
  const runs: ItemRuns = {
    add(i, handle) {
      const list = handles.get(i) ?? [];
      list.push(handle);
      handles.set(i, list);
    },
    wait(i, ms, fn) {
      pendingDelays.set(i, after(ms, () => {
        pendingDelays.delete(i);
        fn();
      }));
    },
    launch(i, jobs, delayMs, canceled, onDone) {
      let jobsLeft = jobs.length;
      const jobDone = (): void => {
        if (--jobsLeft === 0) onDone();
      };
      const spawn = (): void => {
        if (canceled()) return;
        interruptNode(animator, keys[i], root());
        for (const job of jobs) runs.add(i, job(jobDone));
      };
      if (delayMs > 0) runs.wait(i, delayMs, spawn);
      else spawn();
    },
    track: (i) => trackItem(animator, keys[i], stops[i], root()),
    untrack,
    stop(i) {
      pendingDelays.get(i)?.();
      pendingDelays.delete(i);
      for (const h of handles.get(i) ?? []) h.cancel();
      handles.delete(i);
      untrack(i);
    },
  };
  return runs;
}
