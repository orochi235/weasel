import type { StorageAdapter } from './types';

/** Raw strings written before records existed come back as the string they
 *  are. */
export function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Whether `JSON.stringify` would keep `value` exactly. An object key holding
 *  `undefined` counts as kept: JSON drops the key, and reading back an absent
 *  key yields the same `undefined`. */
function isJsonSafe(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (seen.has(value)) return false;
      seen.add(value);
      const proto = Object.getPrototypeOf(value);
      const ok = Array.isArray(value)
        ? value.every((v) => isJsonSafe(v, seen))
        : (proto === Object.prototype || proto === null) &&
          Object.values(value).every((v) => v === undefined || isJsonSafe(v, seen));
      seen.delete(value);
      return ok;
    }
    default:
      return false;
  }
}

function webStorageAdapter(area: () => Storage, name: string, crossTab: boolean): StorageAdapter {
  const warned = new Set<string>();
  const adapter: StorageAdapter = {
    get: async (key) => {
      const raw = area().getItem(key);
      return raw === null ? undefined : parse(raw);
    },
    list: async (prefix) => {
      const store = area();
      const out: [string, unknown][] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key === null || !key.startsWith(prefix)) continue;
        const raw = store.getItem(key);
        if (raw !== null) out.push([key, parse(raw)]);
      }
      return out;
    },
    set: async (key, value) => {
      if (!warned.has(key) && !isJsonSafe(value)) {
        warned.add(key);
        console.warn(
          `[storage] "${key}" holds a value JSON cannot keep exactly; ${name} stores what JSON keeps. Use IndexedDB for binary or non-JSON state.`,
        );
      }
      area().setItem(key, JSON.stringify(value));
    },
    delete: async (key) => {
      area().removeItem(key);
    },
  };
  if (crossTab) {
    adapter.subscribe = (prefix, on) => {
      if (typeof window === 'undefined') return () => {};
      const handler = (e: StorageEvent): void => {
        if (e.key === null || !e.key.startsWith(prefix)) return;
        if (e.storageArea !== area()) return;
        on([[e.key, e.newValue === null ? undefined : parse(e.newValue)]]);
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    };
  }
  return adapter;
}

/** Persist to `localStorage`, one JSON value per record. Survives a reload and
 *  reaches other tabs through the `storage` event. */
export const localStorageAdapter: StorageAdapter = webStorageAdapter(
  () => localStorage,
  'localStorage',
  true,
);

/** Persist to `sessionStorage` — survives a reload but not a new tab. */
export const sessionStorageAdapter: StorageAdapter = webStorageAdapter(
  () => sessionStorage,
  'sessionStorage',
  false,
);
