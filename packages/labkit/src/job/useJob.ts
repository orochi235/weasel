import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobCapability, JobFailure, JobHandle, JobStatus } from './types';

export interface UseJobOptions<TS, TC, TItem> {
  capability: JobCapability<TS, TC, TItem>;
  config: TC;
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
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

export function useJob<TS, TC, TItem>({
  capability,
  config,
  state,
  setState,
}: UseJobOptions<TS, TC, TItem>): JobHandle {
  const [progress, setProgress] = useState<Progress>(IDLE);

  // A run is identified by a token. Every result checks its token before touching
  // state, so a superseded run finishes harmlessly instead of racing the winner.
  const token = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Read through refs: `run` is called once per run and must see the values as of
  // that moment rather than re-subscribing on every render.
  const capRef = useRef(capability);
  capRef.current = capability;
  const configRef = useRef(config);
  configRef.current = config;
  const stateRef = useRef(state);
  stateRef.current = state;
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  const cancel = useCallback(() => {
    token.current += 1;
    abort.current?.abort();
    abort.current = null;
    setProgress(IDLE);
  }, []);

  const start = useCallback(() => {
    token.current += 1;
    const mine = token.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ ...IDLE, status: 'running' });

    void (async () => {
      try {
        const iterable = capRef.current.run({
          config: configRef.current,
          state: stateRef.current,
          signal: controller.signal,
        });
        for await (const event of iterable) {
          if (token.current !== mine) return;
          if (event.kind === 'total') {
            setProgress((p) => ({ ...p, total: event.total }));
          } else if (event.kind === 'failed') {
            setProgress((p) => ({
              ...p,
              failures: [...p.failures, { index: event.index, error: event.error }],
            }));
          } else {
            const fold = capRef.current.onItem;
            const item = event.item;
            setStateRef.current((prev) => fold(item, prev));
            setProgress((p) => ({ ...p, done: p.done + 1 }));
          }
        }
        if (token.current !== mine) return;
        setProgress((p) => ({ ...p, status: 'done' }));
      } catch (err) {
        if (token.current !== mine) return;
        setProgress((p) => ({
          ...p,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
  }, []);

  // Re-run when the declared key changes. `auto` covers the first mount too.
  const lastKey = useRef<readonly unknown[] | null>(null);
  const started = useRef(false);
  const auto = capability.auto === true;
  const key = capability.key ? capability.key(config, state) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is compared element-wise below — depending on the array identity would restart the job every render
  useEffect(() => {
    if (!auto) return;
    if (started.current && sameKey(lastKey.current, key)) return;
    lastKey.current = key;
    started.current = true;
    start();
  }, [auto, key, start]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      token.current += 1;
      abort.current?.abort();
      abort.current = null;
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
