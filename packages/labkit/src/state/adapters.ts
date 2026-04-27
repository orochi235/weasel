import { decodeUrlHash, encodeUrlHash } from './helpers';
import type { StorageAdapter } from './types';

export const localStorageAdapter: StorageAdapter = {
  read: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[labkit] localStorage write failed:', e);
    }
  },
  delete: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const sessionStorageAdapter: StorageAdapter = {
  read: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn('[labkit] sessionStorage write failed:', e);
    }
  },
  delete: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const URL_HASH_GUARD = typeof window !== 'undefined';

function readHashMap(): Record<string, string> {
  if (!URL_HASH_GUARD) return {};
  const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeHashMap(map: Record<string, string>): void {
  if (!URL_HASH_GUARD) return;
  const encoded = encodeUrlHash(JSON.stringify(map));
  window.history.replaceState(null, '', `#${encoded}`);
}

export const urlHashAdapter: StorageAdapter = {
  read: (key) => readHashMap()[key] ?? null,
  write: (key, value) => {
    const map = readHashMap();
    map[key] = value;
    writeHashMap(map);
  },
  delete: (key) => {
    const map = readHashMap();
    delete map[key];
    writeHashMap(map);
  },
};

export function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => {
      store.set(key, value);
    },
    delete: (key) => {
      store.delete(key);
    },
  };
}

export const noneAdapter: StorageAdapter = {
  read: () => null,
  write: () => {},
  delete: () => {},
};
