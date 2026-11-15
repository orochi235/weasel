import { vi } from 'vitest';
import type { Scene } from '../../../core/scene/types';
import type { FromWorker, ToWorker } from '../protocol';

/** A worker that records what the page posts and answers when told. */
export function fakeWorker() {
  const posted: ToWorker[] = [];
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const worker = {
    postMessage: vi.fn((m: ToWorker) => { posted.push(m); }),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    terminate: vi.fn(),
  };
  const emit = (type: string, event: unknown) => { for (const fn of listeners.get(type) ?? []) fn(event); };
  const answer = (data: FromWorker) => emit('message', { data } as MessageEvent<FromWorker>);
  /** An uncaught error in the worker. */
  const fail = (message = 'boom') => emit('error', { message } as ErrorEvent);
  /** A message from the worker that could not be deserialized. */
  const garble = () => emit('messageerror', {} as MessageEvent);
  return { worker: worker as unknown as Worker, posted, answer, fail, garble, terminate: worker.terminate };
}

/** A canvas whose transfer hands back a stand-in, or throws `error`. */
export function fakeCanvas(error?: unknown): HTMLCanvasElement {
  return {
    transferControlToOffscreen: () => {
      if (error !== undefined) throw error;
      return {};
    },
  } as unknown as HTMLCanvasElement;
}

/** How many listeners a client has on `scene`'s stores now. */
export function countSubscriptions(scene: Scene<unknown, string, unknown>): () => number {
  let live = 0;
  const wrap = (store: { subscribe: (fn: () => void) => () => void }) => {
    const subscribe = store.subscribe.bind(store);
    store.subscribe = (fn) => {
      live++;
      const off = subscribe(fn);
      let on = true;
      return () => { if (on) { on = false; live--; } off(); };
    };
  };
  wrap(scene);
  wrap(scene.overrides);
  wrap(scene.scroll);
  return () => live;
}
