/**
 * Whether a render worker is alive, as the page can tell: what it has heard from the worker, the
 * errors the worker raised, and a ping when a request has gone unanswered.
 */
import { createEmitter } from '@weasel-js/registry';
import type { FromWorker, ToWorker } from './protocol';
import { createRequests } from './requests';

/** How a render worker stands. */
export type RenderWorkerStatus =
  /** The canvas is handed over; the worker has not yet said it took it. */
  | { readonly state: 'starting' }
  | { readonly state: 'running' }
  /** Stopped for good: the worker is terminated and every request answered as missing. Its canvas
   *  cannot be handed to another worker, so a restart needs a new canvas. */
  | { readonly state: 'failed'; readonly failure: RenderWorkerFailure }
  | { readonly state: 'disposed' };

/** Why a render worker stopped for good. */
export interface RenderWorkerFailure {
  /** `startup`: its module raised an error before it said anything, so it never ran. `init`: it
   *  could not take the canvas or open a context on it. `unresponsive`: a request went unanswered
   *  for a timeout, and a ping sent then went unanswered for another. */
  readonly reason: 'startup' | 'init' | 'unresponsive';
  readonly message: string;
}

/** How long a render worker's requests wait. */
export interface RenderWorkerOptions {
  /** Milliseconds a frame, snapshot or id read waits for the worker's answer before it settles as
   *  missing, and a ping then waits before the worker counts as unresponsive. `Infinity` waits
   *  forever. Default 10 000. */
  timeout?: number;
}

export const DEFAULT_WORKER_TIMEOUT = 10_000;

const STARTING: RenderWorkerStatus = Object.freeze({ state: 'starting' });
const RUNNING: RenderWorkerStatus = Object.freeze({ state: 'running' });
const DISPOSED: RenderWorkerStatus = Object.freeze({ state: 'disposed' });

/** How several workers painting one canvas stand together: the first failure among them,
 *  else starting while any is, else running. Starting while there are none yet. The same
 *  object while nothing changed, so it can be a store's snapshot. */
export function combinedStatus(all: readonly RenderWorkerStatus[]): RenderWorkerStatus {
  if (all.length === 0) return STARTING;
  const failed = all.find((s) => s.state === 'failed');
  if (failed) return failed;
  if (all.some((s) => s.state === 'starting')) return STARTING;
  if (all.every((s) => s.state === 'disposed')) return DISPOSED;
  return RUNNING;
}

export interface WorkerHealth {
  readonly status: RenderWorkerStatus;
  subscribe(fn: () => void): () => void;
  /** A request went unanswered for a timeout. */
  overdue(): void;
  /** Whether the worker is failed or disposed. */
  readonly stopped: boolean;
  dispose(): void;
}

/**
 * Watch `worker`. An error before its first message, or a fatal one it reports, fails it, and so
 * does a ping unanswered for `timeout`; `fatal` then releases what the page holds for it. An
 * error after that, or a message that cannot be read, may have lost an answer, so `lost` settles
 * what is waiting, and the worker keeps going.
 */
export function watchWorkerHealth(worker: Worker, hooks: {
  timeout: number;
  post: (msg: ToWorker) => void;
  warn: (what: string, detail: unknown) => void;
  fatal: () => void;
  lost: () => void;
}): WorkerHealth {
  let status = STARTING;
  let heard = false;
  const changed = createEmitter();
  const stopped = () => status.state === 'failed' || status.state === 'disposed';
  const set = (next: RenderWorkerStatus) => { status = next; changed.emit(); };
  const fail = (reason: RenderWorkerFailure['reason'], message: string) => {
    if (stopped()) return;
    hooks.warn(`the render worker failed (${reason}):`, message);
    status = { state: 'failed', failure: { reason, message } };
    pings.drain();
    hooks.fatal();
    worker.terminate();
    changed.emit();
  };
  const pings = createRequests<boolean>({
    missing: () => false, timeout: hooks.timeout,
    onTimeout: () => fail('unresponsive', `no answer in ${hooks.timeout} ms`),
  });

  worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
    if (stopped()) return;
    heard = true;
    const msg = event.data;
    if (msg.type === 'ready') set(RUNNING);
    else if (msg.type === 'pong') pings.settle(msg.id, true);
    else if (msg.type === 'error' && msg.fatal) fail('init', msg.message);
    else if (msg.type === 'error') hooks.warn('the render worker failed:', msg.message);
  });
  worker.addEventListener('error', (event: ErrorEvent) => {
    if (stopped()) return;
    if (!heard) return fail('startup', event.message);
    hooks.warn('the render worker raised:', event.message);
    hooks.lost();
  });
  worker.addEventListener('messageerror', () => {
    if (stopped()) return;
    hooks.warn('a message from the render worker could not be read:', 'messageerror');
    hooks.lost();
  });

  return {
    get status() { return status; },
    subscribe: changed.subscribe,
    overdue() {
      if (stopped() || pings.size > 0) return;
      pings.ask((id) => hooks.post({ type: 'ping', id }));
    },
    get stopped() { return stopped(); },
    dispose() {
      if (stopped()) return;
      pings.drain();
      set(DISPOSED);
    },
  };
}
