import { createEmitter } from '@weasel-js/registry';

/** How far one transition has got through its items, and the events and promise that report it. */
export interface TransitionProgress {
  readonly canceled: boolean;
  readonly ended: boolean;
  /** Resolves once every item is done, or the transition is interrupted. */
  readonly end: Promise<void>;
  /** Mark item `i` finished, run `onMarked`, then what waits on it. Does nothing once done or canceled. */
  finish(i: number, onMarked: () => void): void;
  /** Mark item `i` done without running what waits on it; true when it was still running. */
  drop(i: number, interrupted: boolean): boolean;
  /** Run `fn` once item `i` is done; at once (or on a microtask, with `defer`) if it already is. */
  whenDone(i: number, fn: () => void, defer: boolean): void;
  /** End the transition if every item is done. */
  settle(): void;
  /** Emit `start`, the first time only. */
  start(): void;
  /** Interrupt the whole transition: run `teardown`, then emit `interrupt` and end. Once only. */
  cancel(teardown: () => void): void;
  on(event: 'start' | 'end' | 'interrupt', fn: () => void): void;
}

/** Progress over `count` items, none done. */
export function createTransitionProgress(count: number): TransitionProgress {
  const onStart = createEmitter();
  const onEnd = createEmitter();
  const onInterrupt = createEmitter();
  let startFired = false;
  let canceled = false;
  let ended = false;
  let interruptedItem = false;
  const itemDone = Array.from({ length: count }, () => false);
  const itemWaiters = new Map<number, Array<() => void>>();
  let itemsLeft = count;
  let resolveEnd: (() => void) | null = null;
  const end = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });

  const settle = (): void => {
    if (itemsLeft === 0 && !ended) {
      ended = true;
      if (!canceled) (interruptedItem ? onInterrupt : onEnd).emit();
      resolveEnd?.();
    }
  };

  return {
    get canceled() { return canceled; },
    get ended() { return ended; },
    end,
    finish(i, onMarked) {
      if (canceled || itemDone[i]) return;
      itemDone[i] = true;
      itemsLeft--;
      onMarked();
      const waiters = itemWaiters.get(i);
      itemWaiters.delete(i);
      waiters?.forEach((fn) => fn());
      settle();
    },
    drop(i, interrupted) {
      if (canceled || itemDone[i]) return false;
      itemDone[i] = true;
      itemsLeft--;
      itemWaiters.delete(i);
      if (interrupted) interruptedItem = true;
      return true;
    },
    whenDone(i, fn, defer) {
      if (!itemDone[i]) {
        const list = itemWaiters.get(i) ?? [];
        list.push(fn);
        itemWaiters.set(i, list);
      } else if (defer) {
        queueMicrotask(fn);
      } else {
        fn();
      }
    },
    settle,
    start() {
      if (startFired) return;
      startFired = true;
      onStart.emit();
    },
    cancel(teardown) {
      if (canceled || ended) return;
      canceled = true;
      teardown();
      itemWaiters.clear();
      onInterrupt.emit();
      ended = true;
      resolveEnd?.();
    },
    on(event, fn) {
      if (event === 'start') onStart.subscribe(fn);
      else if (event === 'end') onEnd.subscribe(fn);
      else if (event === 'interrupt') onInterrupt.subscribe(fn);
    },
  };
}
