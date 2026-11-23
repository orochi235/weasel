import { useLatest } from '@weasel-js/core';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { JobCapability, JobFailure, JobHandle, JobStatus } from './types';

/** Inputs to `useJob`. `setState` receives each item folded in by the
 *  capability's `onItem`. */
export interface UseJobOptions<TS, TC, TItem> {
  capability: JobCapability<TS, TC, TItem>;
  config: TC;
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  /** A new value drops the run in flight, and starts an `auto` job again even
   *  where its `key` is unchanged: the state the run was folding into is gone. */
  epoch?: unknown;
}

interface Progress {
  status: JobStatus;
  done: number;
  total: number | null;
  failures: JobFailure[];
  error: string | null;
}

const IDLE: Progress = { status: 'idle', done: 0, total: null, failures: [], error: null };

function sameKey(a: readonly unknown[] | null, b: readonly unknown[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * One run of the capability `cap()` reads: its items folded into state and its events into progress while `live()`
 * holds. A superseded run ends without touching either.
 */
async function drive<TS, TC, TItem>(
  cap: () => JobCapability<TS, TC, TItem>,
  args: { config: TC; state: TS; signal: AbortSignal },
  live: () => boolean,
  setState: (fold: (prev: TS) => TS) => void,
  setProgress: Dispatch<SetStateAction<Progress>>,
): Promise<void> {
  try {
    for await (const event of cap().run(args)) {
      if (!live()) return;
      if (event.kind === 'total') {
        setProgress((p) => ({ ...p, total: event.total }));
      } else if (event.kind === 'failed') {
        setProgress((p) => ({
          ...p,
          failures: [...p.failures, { index: event.index, error: event.error }],
        }));
      } else {
        const fold = cap().onItem;
        const item = event.item;
        setState((prev) => fold(item, prev));
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    if (!live()) return;
    setProgress((p) => ({ ...p, status: 'done' }));
  } catch (err) {
    if (!live()) return;
    setProgress((p) => ({
      ...p,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

/**
 * Applies `begin` through `setState` and launches the run on what it made, so `run` sees the state its items fold
 * into. A `useState` setter may run the updater only at its next render: then this returns the retry to call after
 * it, which reports whether it is done. A run no longer `live` launches nothing.
 */
function beginThenLaunch<TS>(
  begin: (prev: TS) => TS,
  setState: (next: (prev: TS) => TS) => void,
  launch: (state: TS) => void,
  live: () => boolean,
): (() => boolean) | null {
  const began: { state?: TS; done: boolean } = { done: false };
  setState((prev) => {
    began.state = begin(prev);
    began.done = true;
    return began.state;
  });
  const tryLaunch = (): boolean => {
    if (!live()) return true;
    if (!began.done) return false;
    launch(began.state as TS);
    return true;
  };
  return tryLaunch() ? null : tryLaunch;
}

/**
 * Drive a `JobCapability` and report its progress. `start` cancels any run in
 * flight and begins again; results from a superseded or canceled run are
 * dropped. A `key` change element-wise starts it again: with `auto` always, on
 * mount too; without, only once something has started it and not canceled it
 * since. Unmounting aborts the run.
 */
export function useJob<TS, TC, TItem>({
  capability,
  config,
  state,
  setState,
  epoch,
}: UseJobOptions<TS, TC, TItem>): JobHandle {
  const [progress, setProgress] = useState<Progress>(IDLE);

  // A run is identified by a token. Every result checks its token before touching
  // state, so a superseded run finishes harmlessly instead of racing the winner.
  const token = useRef(0);
  const abort = useRef<AbortController | null>(null);
  /** Whether a run was started and not canceled since: what a job without `auto` re-runs on a `key` change. */
  const ran = useRef(false);
  /** A started run still waiting on its `begin` updater to have run. */
  const pendingLaunch = useRef<(() => boolean) | null>(null);

  // Read through refs: `run` is called once per run and must see the values as of
  // that moment rather than re-subscribing on every render.
  const capRef = useLatest(capability);
  const configRef = useLatest(config);
  const stateRef = useLatest(state);
  const setStateRef = useLatest(setState);

  const cancel = useCallback(() => {
    ran.current = false;
    token.current += 1;
    abort.current?.abort();
    abort.current = null;
    setProgress(IDLE);
  }, []);

  const start = useCallback(() => {
    ran.current = true;
    token.current += 1;
    const mine = token.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ ...IDLE, status: 'running' });
    const begin = capRef.current.begin;
    const startConfig = configRef.current;
    const launch = (startState: TS): void =>
      void drive(
        () => capRef.current,
        { config: startConfig, state: startState, signal: controller.signal },
        () => token.current === mine,
        (fold) => setStateRef.current(fold),
        setProgress,
      );
    pendingLaunch.current = null;
    if (!begin) {
      launch(stateRef.current);
      return;
    }
    pendingLaunch.current = beginThenLaunch(
      (prev) => begin(prev, startConfig),
      setStateRef.current,
      launch,
      () => token.current === mine,
    );
  }, [capRef, configRef, setStateRef, stateRef]);

  useLayoutEffect(() => {
    if (pendingLaunch.current?.()) pendingLaunch.current = null;
  });

  // Re-run when the declared key changes. `auto` covers the first mount too.
  const lastKey = useRef<readonly unknown[] | null>(null);
  const lastEpoch = useRef(epoch);
  const started = useRef(false);
  const auto = capability.auto === true;
  const key = capability.key ? capability.key(config, state) : null;
  // `key` is compared element-wise inside; depending on the array identity here
  // would restart the job on every render.
  useEffect(() => {
    const fresh = !Object.is(lastEpoch.current, epoch);
    lastEpoch.current = epoch;
    const moved = started.current && !sameKey(lastKey.current, key);
    lastKey.current = key;
    if (!auto) {
      started.current = true;
      if (fresh) cancel();
      else if (moved && ran.current) start();
      return;
    }
    if (!fresh && started.current && !moved) return;
    started.current = true;
    start();
  }, [auto, key, start, cancel, epoch]);

  useEffect(
    () => () => {
      token.current += 1;
      abort.current?.abort();
      abort.current = null;
      // StrictMode re-runs the effects after this; the auto start has to run again.
      started.current = false;
    },
    [],
  );

  return {
    status: progress.status,
    done: progress.done,
    total: progress.total,
    failures: progress.failures,
    error: progress.error,
    start,
    cancel,
  };
}
