// Integration test: scene + history round-trip through IDB.
//
// Mirrors the in-memory IDB shim used by `sceneStore.test.ts` so we can
// exercise the full save → load path without pulling `fake-indexeddb`.
// The flow:
//   1. Build a fresh History bound to an in-process adapter.
//   2. Apply two transform ops.
//   3. Build a SceneSnapshot with `history: history.serialize()` and call
//      `saveScene`.
//   4. Call `loadScene` and feed the restored history into a *new* History
//      bound to a fresh adapter pre-seeded to the post-edit state.
//   5. Assert undo / redo on the restored history continues from the same
//      position the original was at when serialized.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createHistory,
  createTransformOp,
  type History,
} from '@orochi235/weasel';
import { DB_NAME, loadScene, saveScene, type SceneSnapshot } from './sceneStore';

// ──────────────────────────────────────────────────────────────────────────
// Minimal in-memory IDB shim (copy of the one in sceneStore.test.ts). We
// duplicate rather than export-and-share so each test file owns its own
// universe and they don't accidentally cross-contaminate when run in the
// same vitest worker.
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
}

const universe = new Map<string, DbState>();

function makeRequest<T>(value: T | undefined, error: Error | null = null): FakeRequest<T> {
  const req: FakeRequest<T> = { result: value, error, onsuccess: null, onerror: null };
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
      return makeRequest<unknown>(m.has(key) ? m.get(key) : undefined);
    },
    put(value: unknown, key: string) {
      const m = state.stores.get(storeName)!;
      m.set(key, value);
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
    objectStoreNames: { contains: (s: string) => state.stores.has(s) },
    createObjectStore: (s: string) => {
      if (!state.stores.has(s)) state.stores.set(s, new Map());
    },
    transaction(s: string): FakeTx {
      const tx: FakeTx = {
        oncomplete: null, onerror: null, onabort: null, error: null,
        objectStore: () => makeStore(state, s, 'readwrite', tx),
      };
      return tx;
    },
    close: () => { /* no-op */ },
  };
}

function installFakeIDB(): void {
  const factory: IDBFactory = {
    open(name: string, version?: number): IDBOpenDBRequest {
      const req: FakeOpenRequest = {
        result: undefined, error: null,
        onsuccess: null, onerror: null,
        onupgradeneeded: null, onblocked: null,
      };
      const targetVersion = version ?? 1;
      if (!universe.has(name)) universe.set(name, { version: 0, stores: new Map() });
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
    cmp: (a: unknown, b: unknown) =>
      (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0,
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
// Adapter shape: bare-minimum surface the transform op needs (`setPose`).
// ──────────────────────────────────────────────────────────────────────────

interface Pose { x: number; y: number }

function makeAdapter(initial?: Record<string, Pose>) {
  const state = new Map<string, Pose>();
  if (initial) for (const [id, p] of Object.entries(initial)) state.set(id, { ...p });
  return {
    setPose: (id: string, p: Pose) => state.set(id, { ...p }),
    state,
  };
}

beforeAll(() => { installFakeIDB(); });
beforeEach(() => { universe.delete(DB_NAME); });

describe('scene + history persistence', () => {
  it('round-trips the undo stack via IDB so undo continues post-reload', async () => {
    // Session A: build the original history.
    const adapterA = makeAdapter({ a: { x: 0, y: 0 } });
    const historyA: History = createHistory(adapterA);
    historyA.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 10, y: 10 },
    }));
    historyA.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 10, y: 10 }, to: { x: 20, y: 20 },
    }));
    expect(adapterA.state.get('a')).toEqual({ x: 20, y: 20 });
    expect(historyA.entries().undo).toHaveLength(2);

    // Persist scene + history.
    const snap: SceneSnapshot = {
      version: 1,
      items: [
        // The scene-store cares about an `items` array but here the contents
        // are opaque — the history test only needs the history field to
        // round-trip. Use a sentinel so we can prove the scene field
        // survives alongside history.
        { id: 'a', tool: 'rect', x: 20, y: 20, width: 1, height: 1 } as never,
      ],
      groups: [],
      doc: { size: { width: 100, height: 100 } },
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      selection: [],
      history: historyA.serialize(),
    };
    await saveScene(snap);

    // Session B: simulate a reload — fresh adapter pre-seeded to the saved
    // post-edit state (mirrors how `usePersistedScene` runs scene-restore
    // BEFORE history-restore), then restore history.
    const loaded = await loadScene();
    expect(loaded).not.toBeNull();
    expect(loaded!.history).toBeDefined();
    expect(loaded!.history!.undoStack).toHaveLength(2);

    const adapterB = makeAdapter({ a: { x: 20, y: 20 } });
    const historyB: History = createHistory(adapterB);
    historyB.restore(loaded!.history!);

    // Undo continues from where session A left off.
    expect(historyB.canUndo()).toBe(true);
    expect(historyB.canRedo()).toBe(false);
    historyB.undo();
    expect(adapterB.state.get('a')).toEqual({ x: 10, y: 10 });
    historyB.undo();
    expect(adapterB.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(historyB.canUndo()).toBe(false);
    expect(historyB.canRedo()).toBe(true);
    // Redo chain also intact.
    historyB.redo();
    expect(adapterB.state.get('a')).toEqual({ x: 10, y: 10 });
    historyB.redo();
    expect(adapterB.state.get('a')).toEqual({ x: 20, y: 20 });
  });

  it('handles snapshots without a history field (legacy / pre-feature)', async () => {
    // Save a snapshot that has no history (older shape).
    const snap: SceneSnapshot = {
      version: 1,
      items: [],
      groups: [],
      doc: { size: { width: 100, height: 100 } },
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    };
    await saveScene(snap);
    const loaded = await loadScene();
    expect(loaded).not.toBeNull();
    expect(loaded!.history).toBeUndefined();
  });

  it('restores a partially-traversed history (undo + redo both non-empty)', async () => {
    const adapterA = makeAdapter({ a: { x: 0, y: 0 } });
    const historyA: History = createHistory(adapterA);
    historyA.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 0, y: 0 }, to: { x: 5, y: 0 },
    }));
    historyA.apply(createTransformOp<Pose>({
      id: 'a', from: { x: 5, y: 0 }, to: { x: 10, y: 0 },
    }));
    historyA.undo(); // one entry on redo stack
    expect(adapterA.state.get('a')).toEqual({ x: 5, y: 0 });

    await saveScene({
      version: 1,
      items: [],
      groups: [],
      doc: { size: { width: 100, height: 100 } },
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      history: historyA.serialize(),
    });
    const loaded = await loadScene();
    expect(loaded!.history!.undoStack).toHaveLength(1);
    expect(loaded!.history!.redoStack).toHaveLength(1);

    const adapterB = makeAdapter({ a: { x: 5, y: 0 } });
    const historyB: History = createHistory(adapterB);
    historyB.restore(loaded!.history!);
    historyB.redo();
    expect(adapterB.state.get('a')).toEqual({ x: 10, y: 0 });
    historyB.undo();
    historyB.undo();
    expect(adapterB.state.get('a')).toEqual({ x: 0, y: 0 });
  });
});
