import { createPart } from '@weasel-js/registry';
import type { StorageAdapter, StorageChange, SyncStorageAdapter } from './types';

interface MemorySubscriber {
  owner: StorageAdapter;
  prefix: string;
  on: (changes: StorageChange[]) => void;
}

const subscribersOf = createPart((_backing: Map<string, unknown>) => new Set<MemorySubscriber>());

/** An in-memory store, discarded on reload. Values are copied in and out, as a
 *  real substrate would. Adapters built over one shared `backing` hear each
 *  other's writes — two tabs, for a test. */
export function createMemoryAdapter(backing: Map<string, unknown> = new Map()): SyncStorageAdapter {
  const peers = subscribersOf(backing);
  const notify = (key: string, value: unknown): void => {
    for (const sub of peers) {
      if (sub.owner === adapter || !key.startsWith(sub.prefix)) continue;
      const copy = value === undefined ? undefined : structuredClone(value);
      queueMicrotask(() => {
        if (peers.has(sub)) sub.on([[key, copy]]);
      });
    }
  };
  const listNow = (prefix: string): [string, unknown][] =>
    [...backing]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]): [string, unknown] => [key, structuredClone(value)]);
  const adapter: SyncStorageAdapter = {
    get: async (key) => (backing.has(key) ? structuredClone(backing.get(key)) : undefined),
    list: async (prefix) => listNow(prefix),
    listSync: listNow,
    set: async (key, value) => {
      if (value === undefined) return adapter.delete(key);
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
export const noneAdapter: SyncStorageAdapter = {
  get: async () => undefined,
  list: async () => [],
  listSync: () => [],
  set: async () => {},
  delete: async () => {},
};
