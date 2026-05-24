import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import {
  DB_NAME, DB_VERSION, STORE_NAME, SCENE_KEY,
  loadScene, saveScene, clearScene, openDb,
  type SceneSnapshot,
} from './sceneStore';

// ──────────────────────────────────────────────────────────────────────────
// Minimal in-memory IDB shim.
//
// We don't pull `fake-indexeddb` (not in node_modules); the surface we need
// is small. The shim covers what `sceneStore` actually calls:
//   - open + onupgradeneeded + onsuccess
//   - createObjectStore
//   - transaction(STORE_NAME, mode).objectStore(STORE_NAME)
//   - get/put/delete (returning IDBRequest-shaped objects)
//   - tx.oncomplete / onerror
//   - db.close()
// Anything else throws so the test fails loudly if usage drifts.
// ──────────────────────────────────────────────────────────────────────────

type Mode = 'readonly' | 'readwrite';

interface FakeRequest<T> {
  result: T | undefined;
  error: Error | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface FakeTx {
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  error: Error | null;
  objectStore(name: string): FakeStore;
}

interface FakeStore {
  get(key: string): FakeRequest<unknown>;
  put(value: unknown, key: string): FakeRequest<void>;
  delete(key: string): FakeRequest<void>;
}

interface FakeDb {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): void;
  transaction(name: string, mode: Mode): FakeTx;
  close(): void;
}

interface FakeOpenRequest {
  result: FakeDb | undefined;
  error: Error | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}

interface DbState {
  version: number;
  stores: Map<string, Map<string, unknown>>;
  /** Set when a test wants the next operation to fail (corruption sim). */
  failGet?: boolean;
}

const universe = new Map<string, DbState>();
/** Test hook: force the next `get` on the named store to throw, simulating
 *  a structured-clone read failure. */
function forceGetFailureOnce(dbName: string): void {
  const st = universe.get(dbName);
  if (st) st.failGet = true;
}

function makeRequest<T>(value: T | undefined, error: Error | null = null): FakeRequest<T> {
  const req: FakeRequest<T> = { result: value, error, onsuccess: null, onerror: null };
  // Fire callbacks on the next microtask so the caller has a chance to
  // attach onsuccess/onerror (mirrors real IDB).
  queueMicrotask(() => {
    if (error) req.onerror?.();
    else req.onsuccess?.();
  });
  return req;
}

function makeStore(state: DbState, storeName: string, _mode: Mode, tx: FakeTx): FakeStore {
  return {
    get(key: string) {
      const m = state.stores.get(storeName)!;
      if (state.failGet) {
        state.failGet = false;
        return makeRequest<unknown>(undefined, new Error('simulated read failure'));
      }
      return makeRequest<unknown>(m.has(key) ? m.get(key) : undefined);
    },
    put(value: unknown, key: string) {
      const m = state.stores.get(storeName)!;
      m.set(key, value);
      // Schedule tx.oncomplete after this microtask. Real IDB ties tx
      // completion to all requests landing; here we simply complete after
      // the put's own success callback would have fired.
      const req = makeRequest<void>(undefined);
      queueMicrotask(() => { tx.oncomplete?.(); });
      return req;
    },
    delete(key: string) {
      const m = state.stores.get(storeName)!;
      m.delete(key);
      const req = makeRequest<void>(undefined);
      queueMicrotask(() => { tx.oncomplete?.(); });
      return req;
    },
  };
}

function makeDb(name: string): FakeDb {
  const state = universe.get(name)!;
  return {
    objectStoreNames: {
      contains: (s: string) => state.stores.has(s),
    },
    createObjectStore: (s: string) => {
      if (!state.stores.has(s)) state.stores.set(s, new Map());
    },
    transaction(s: string, mode: Mode): FakeTx {
      const tx: FakeTx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore: (_n: string) => makeStore(state, s, mode, tx),
      };
      return tx;
    },
    close: () => { /* no-op for the shim */ },
  };
}

function installFakeIDB(): void {
  const factory: IDBFactory = {
    open(name: string, version?: number): IDBOpenDBRequest {
      const req: FakeOpenRequest = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };
      const targetVersion = version ?? 1;
      const existing = universe.get(name);
      if (!existing) {
        universe.set(name, { version: 0, stores: new Map() });
      }
      const state = universe.get(name)!;
      const needsUpgrade = state.version < targetVersion;
      const db = makeDb(name);
      req.result = db;
      queueMicrotask(() => {
        if (needsUpgrade) {
          state.version = targetVersion;
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req as unknown as IDBOpenDBRequest;
    },
    deleteDatabase(name: string): IDBOpenDBRequest {
      universe.delete(name);
      const req: FakeOpenRequest = {
        result: undefined, error: null,
        onsuccess: null, onerror: null,
        onupgradeneeded: null, onblocked: null,
      };
      queueMicrotask(() => req.onsuccess?.());
      return req as unknown as IDBOpenDBRequest;
    },
    cmp: (a: unknown, b: unknown) => (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0,
    databases: async () => [],
  };
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get: () => factory,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => factory,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

beforeAll(() => { installFakeIDB(); });

const sampleSnapshot = (): SceneSnapshot => ({
  version: 1,
  items: [
    {
      id: 'r1',
      tool: 'rect',
      x: 10, y: 20, width: 100, height: 50,
      // PolygonPath shape isn't strictly needed for the round-trip test —
      // structured clone handles whatever we throw at it. Use a minimal
      // path-shaped value plus a Float32Array to prove typed arrays survive.
      path: {
        kind: 'polygon',
        coords: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        flags: new Uint8Array([0, 0, 0, 0]),
      } as never,
      closed: true,
      fill: '#7fb069',
      stroke: '#1a130d',
      strokeWidth: 1,
    },
  ],
  groups: [],
  doc: { size: { width: 816, height: 1056 } },
  view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
});

describe('sceneStore', () => {
  beforeEach(async () => {
    // Wipe the named DB between tests so each starts empty.
    universe.delete(DB_NAME);
  });

  it('exposes the expected constants', () => {
    expect(DB_NAME).toBe('weaseldraw');
    expect(DB_VERSION).toBe(1);
    expect(STORE_NAME).toBe('scene');
    expect(SCENE_KEY).toBe('current');
  });

  it('returns null when the store is empty', async () => {
    const out = await loadScene();
    expect(out).toBeNull();
  });

  it('round-trips save → load', async () => {
    const snap = sampleSnapshot();
    await saveScene(snap);
    const loaded = await loadScene();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.items).toHaveLength(1);
    expect(loaded!.items[0].id).toBe('r1');
    expect(loaded!.doc.size.width).toBe(816);
    expect(loaded!.view).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    // Typed arrays come back as their original views.
    const path = (loaded!.items[0] as unknown as { path: { coords: Float32Array; flags: Uint8Array } }).path;
    expect(path.coords).toBeInstanceOf(Float32Array);
    expect(Array.from(path.coords)).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
    expect(path.flags).toBeInstanceOf(Uint8Array);
  });

  it('treats a version-mismatched record as missing', async () => {
    // Sneak a bad record directly into the store, bypassing saveScene's typing.
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ version: 99, items: [], groups: [], doc: {}, view: {} } as never, SCENE_KEY);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    db.close();
    const out = await loadScene();
    expect(out).toBeNull();
  });

  it('tolerates a corrupted record (read throws)', async () => {
    await saveScene(sampleSnapshot());
    forceGetFailureOnce(DB_NAME);
    const out = await loadScene();
    expect(out).toBeNull();
  });

  it('clearScene removes the record', async () => {
    await saveScene(sampleSnapshot());
    expect(await loadScene()).not.toBeNull();
    await clearScene();
    expect(await loadScene()).toBeNull();
  });

  it('saveScene swallows errors when IDB is unavailable', async () => {
    // Temporarily hide indexedDB. The descriptor we installed is configurable
    // so we can swap it out and restore.
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => undefined,
    });
    try {
      // Both should resolve without throwing.
      await expect(saveScene(sampleSnapshot())).resolves.toBeUndefined();
      await expect(loadScene()).resolves.toBeNull();
    } finally {
      if (originalDesc) Object.defineProperty(globalThis, 'indexedDB', originalDesc);
    }
  });
});
