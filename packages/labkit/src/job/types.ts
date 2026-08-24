/** What a running job reports as it goes. `total` may arrive at any point and may
 *  arrive more than once; a job that cannot count up front simply never sends it.
 *
 *  `failed` is a first-class event rather than a thrown error because these
 *  failures are per item: a run with two failed items is a partial success, and
 *  its other items are worth showing. */
export type JobEvent<T> =
  | { kind: 'total'; total: number }
  | { kind: 'item'; item: T }
  | { kind: 'failed'; index: number; error: string };

/** Where a job is. `idle` before its first run and after a cancel; `done` when the
 *  iterable finished, whether or not items failed along the way. */
export type JobStatus = 'idle' | 'running' | 'done' | 'error';

/** Declares that an instrument has work too slow to do during a render: what to
 *  run, when to re-run it, and how each result folds into state. */
export interface JobCapability<TS = unknown, TC = unknown, TItem = unknown> {
  /** Re-run whenever this value changes, compared element-wise. A job with no
   *  `key` runs only when something calls `start()`. */
  key?: (config: TC, state: TS) => readonly unknown[];
  /** Start on mount and on every `key` change. Default false. */
  auto?: boolean;
  run: (args: { config: TC; state: TS; signal: AbortSignal }) => AsyncIterable<JobEvent<TItem>>;
  /** Fold one result into state. Called once per `item` event, in arrival order. */
  onItem: (item: TItem, state: TS) => TS;
}

/** One item that failed, and why. */
export interface JobFailure {
  index: number;
  error: string;
}

/** What `RenderContext.job` exposes. Present only when the instrument declares the
 *  capability; `undefined` otherwise. */
export interface JobHandle {
  status: JobStatus;
  done: number;
  /** Null until the job reports a total, and forever if it never does. */
  total: number | null;
  failures: readonly JobFailure[];
  /** The error that ended the run, when `status` is `'error'`. */
  error: string | null;
  start: () => void;
  cancel: () => void;
}
