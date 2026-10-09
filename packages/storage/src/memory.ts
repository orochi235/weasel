import type { StorageAdapter, StorageChange } from './types';

interface MemorySubscriber {
  owner: StorageAdapter;
  prefix: string;
  on: (changes: StorageChange[]) => void;
}

const memorySubscribers = new WeakMap<Map<string, unknown>, Set<MemorySubscriber>>();

/** An in-memory store, discarded on reload. Values are copied in and out, as a
 *  real substrate would. Adapters built over one shared `backing` hear each
 *  other's writes — two tabs, for a test. */
export function createMemoryAdapter(backing: Map<string, unknown> = new Map()): StorageAdapter {
  let subscribers = memorySubscribers.get(backing);
  if (!subscribers) {
    subscribers = new Set();
    memorySubscribers.set(backing, subscribers);
  }
  const peers = subscribers;
  const notify = (key: string, value: unknown): void => {
    for (const sub of peers) {
      if (sub.owner === adapter || !key.startsWith(sub.prefix)) continue;
      const copy = value === undefined ? undefined : structuredClone(value);
      queueMicrotask(() => sub.on([[key, copy]]));
    }
  };
  const adapter: StorageAdapter = {
    get: async (key) => (backing.has(key) ? structuredClone(backing.get(key)) : undefined),
    list: async (prefix) =>
      [...backing]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]): [string, unknown] => [key, structuredClone(value)]),
    set: async (key, value) => {
      const copy = structuredClone(value);
      backing.set(key, copy);
      notify(key, copy);
    },
    delete: async (key) => {
      backing.delete(key);
      notify(key, undefined);
    },
    subscribe: (prefix, on) => {
      const sub = { owner: adapter, prefix, on };
      peers.add(sub);
      return () => {
        peers.delete(sub);
      };
    },
  };
  return adapter;
}

/** Persists nothing and reads back nothing. */
export const noneAdapter: StorageAdapter = {
  get: async () => undefined,
  list: async () => [],
  set: async () => {},
  delete: async () => {},
};
