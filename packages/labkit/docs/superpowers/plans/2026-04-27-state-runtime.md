# Labkit Plan 2 — State Runtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `src/state/` subsystem — per-Lab Zustand store, workspace state shape, storage adapters, persistence machinery, `useExperimentState()` hook, and save/load slot operations — with full test coverage. No UI components are written in this plan.

**Architecture:** Zustand vanilla store (not the hook form) created per `<Lab>` instance. React context bridges it into the component tree. Storage adapters are synchronous value types. Persistence is debounced (300 ms). Pure helpers are separated into their own modules for independent unit testing. All implementation follows the design spec at `docs/superpowers/specs/2026-04-27-state-runtime-design.md`.

**Tech Stack:** React 19, TypeScript 6, Zustand 5, Vitest 4, @testing-library/react 16, jsdom. No new dependencies required — zustand is already in `package.json`.

**Prerequisite:** `plan-1-foundation` is tagged and `npm install` has been run. The `package.json`, `biome.jsonc`, `tsconfig.lib.json`, and `vitest.config.ts` are all in place.

---

## File Structure

After this plan:
```
labkit/
  src/
    state/
      types.ts                  # All exported TypeScript interfaces and types
      helpers.ts                # Pure stateless helpers (labStorageKey, encodeUrlHash, etc.)
      helpers.test.ts
      adapters.ts               # StorageAdapter implementations
      adapters.test.ts
      store.ts                  # createLabStore — Zustand vanilla store + actions
      store.test.ts
      context.tsx               # LabStoreProvider, WorkspaceIdProvider, context objects
      useExperimentState.ts     # useExperimentState hook
      useExperimentState.test.tsx
      index.ts                  # Public re-exports for @labkit/react/state entry point
```

---

## Task 1: Types module

**Files:**
- Create: `src/state/types.ts`

- [ ] **Step 1: Create `src/state/types.ts` with all shared types**

Write the file with the following exported interfaces (taken verbatim from design spec §2.1):

```ts
export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

export interface WorkspaceRecord<TS = unknown, TC = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  undoStack: UndoStack;
}

export interface SavedSnapshot {
  id: string;
  name: string;
  workspaceId: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  savedAt: number;
}

export interface LabStoreState {
  workspaces: WorkspaceRecord[];
  savedSnapshots: SavedSnapshot[];
  theme: 'light' | 'dark' | 'auto';
}

export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  delete?(key: string): void;
}

export interface ExperimentStateHandle<TS, TC> {
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  config: TC;
  setConfig: (key: keyof TC, value: TC[keyof TC]) => void;
}

export interface CreateLabStoreOptions {
  storageKey: string;
  storage: StorageAdapter;
  initialTheme?: 'light' | 'dark' | 'auto';
}

export type InstrumentSerializers = Record<
  string,
  | { serialize?: (state: unknown) => unknown; deserialize?: (data: unknown) => unknown }
  | undefined
>;
```

- [ ] **Step 2: Verify the file type-checks cleanly**

Run: `cd ~/src/labkit && npx tsc -b --noEmit`
Expected: exits with code 0; no output.

- [ ] **Step 3: Commit**

```bash
cd ~/src/labkit
git add src/state/types.ts
git commit -m "state: add shared type definitions (WorkspaceRecord, SavedSnapshot, StorageAdapter, etc.)"
```

---

## Task 2: Pure helpers

**Files:**
- Create: `src/state/helpers.ts`
- Create: `src/state/helpers.test.ts`

- [ ] **Step 1: Write failing tests first (`helpers.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import {
  labStorageKey,
  encodeUrlHash,
  decodeUrlHash,
  emptyUndoStack,
  serializeWorkspaces,
  deserializeWorkspaces,
} from './helpers.js';
import type { WorkspaceRecord } from './types.js';

describe('labStorageKey', () => {
  it('produces namespaced keys', () => {
    expect(labStorageKey('my-lab', 'workspaces')).toBe('lk:my-lab:workspaces');
    expect(labStorageKey('my-lab', 'saves')).toBe('lk:my-lab:saves');
    expect(labStorageKey('my-lab', 'theme')).toBe('lk:my-lab:theme');
  });
});

describe('encodeUrlHash / decodeUrlHash', () => {
  it('round-trips a string', () => {
    const original = JSON.stringify({ workspaces: '[]', saves: '[]' });
    expect(decodeUrlHash(encodeUrlHash(original))).toBe(original);
  });

  it('returns null for an empty or invalid hash', () => {
    expect(decodeUrlHash('')).toBeNull();
    expect(decodeUrlHash('not-base64!!!')).toBeNull();
  });
});

describe('emptyUndoStack', () => {
  it('returns an empty stack', () => {
    expect(emptyUndoStack()).toEqual({ past: [], future: [] });
  });
});

describe('serializeWorkspaces / deserializeWorkspaces', () => {
  const ws: WorkspaceRecord = {
    id: 'w1',
    instrumentName: 'Test',
    config: { x: 1 },
    state: { items: [] },
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    undoStack: { past: [1, 2], future: [] }, // should be stripped
  };

  it('round-trips workspace records', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result.id).toBe('w1');
    expect(result.state).toEqual({ items: [] });
  });

  it('strips undoStack on serialization', () => {
    const serialized = serializeWorkspaces([ws], {});
    const parsed = JSON.parse(serialized) as unknown[];
    expect((parsed[0] as Record<string, unknown>).undoStack).toBeUndefined();
  });

  it('restores emptyUndoStack after deserialization', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result.undoStack).toEqual({ past: [], future: [] });
  });

  it('uses instrument.serialize / deserialize when provided', () => {
    const serializers = {
      Test: {
        serialize: (s: unknown) => ({ compressed: true, data: s }),
        deserialize: (d: unknown) => (d as { data: unknown }).data,
      },
    };
    const serialized = serializeWorkspaces([ws], serializers);
    const [result] = deserializeWorkspaces(serialized, serializers);
    expect(result.state).toEqual({ items: [] });
  });

  it('falls back to identity when instrumentName not in registry', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result.state).toEqual({ items: [] });
  });

  it('returns empty array for malformed JSON', () => {
    const result = deserializeWorkspaces('NOT JSON', {});
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

Run: `cd ~/src/labkit && npx vitest run src/state/helpers.test.ts`
Expected: module not found / multiple failures.

- [ ] **Step 3: Implement `helpers.ts`**

```ts
import type { WorkspaceRecord, UndoStack, InstrumentSerializers } from './types.js';

export function labStorageKey(storageKey: string, bucket: 'workspaces' | 'saves' | 'theme'): string {
  return `lk:${storageKey}:${bucket}`;
}

export function encodeUrlHash(value: string): string {
  return btoa(encodeURIComponent(value));
}

export function decodeUrlHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
}

export function emptyUndoStack(): UndoStack {
  return { past: [], future: [] };
}

type SerializedRecord = Omit<WorkspaceRecord, 'undoStack'>;

export function serializeWorkspaces(
  workspaces: WorkspaceRecord[],
  serializers: InstrumentSerializers,
): string {
  const records: SerializedRecord[] = workspaces.map(({ undoStack: _undo, ...w }) => {
    const s = serializers[w.instrumentName];
    return {
      ...w,
      state: s?.serialize ? s.serialize(w.state) : w.state,
    };
  });
  return JSON.stringify(records);
}

export function deserializeWorkspaces(
  raw: string,
  deserializers: InstrumentSerializers,
): WorkspaceRecord[] {
  try {
    const records = JSON.parse(raw) as SerializedRecord[];
    return records.map((r) => {
      const d = deserializers[r.instrumentName];
      return {
        ...r,
        state: d?.deserialize ? d.deserialize(r.state) : r.state,
        undoStack: emptyUndoStack(),
      };
    });
  } catch {
    console.warn('[labkit] deserializeWorkspaces: failed to parse, returning empty list');
    return [];
  }
}
```

- [ ] **Step 4: Run tests — confirm they all pass**

Run: `cd ~/src/labkit && npx vitest run src/state/helpers.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/src/labkit
git add src/state/helpers.ts src/state/helpers.test.ts
git commit -m "state: add pure helpers (labStorageKey, encodeUrlHash, serialize/deserialize workspaces)"
```

---

## Task 3: Storage adapters

**Files:**
- Create: `src/state/adapters.ts`
- Create: `src/state/adapters.test.ts`

- [ ] **Step 1: Write failing tests first (`adapters.test.ts`)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  localStorageAdapter,
  sessionStorageAdapter,
  urlHashAdapter,
  createMemoryAdapter,
  noneAdapter,
} from './adapters.js';

// --- localStorageAdapter ---
describe('localStorageAdapter', () => {
  beforeEach(() => localStorage.clear());

  it('writes and reads a value', () => {
    localStorageAdapter.write('k', 'v');
    expect(localStorageAdapter.read('k')).toBe('v');
  });

  it('returns null for missing key', () => {
    expect(localStorageAdapter.read('missing')).toBeNull();
  });

  it('deletes a key', () => {
    localStorageAdapter.write('k', 'v');
    localStorageAdapter.delete?.('k');
    expect(localStorageAdapter.read('k')).toBeNull();
  });

  it('handles QuotaExceededError gracefully', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => localStorageAdapter.write('k', 'v')).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// --- sessionStorageAdapter ---
describe('sessionStorageAdapter', () => {
  beforeEach(() => sessionStorage.clear());

  it('writes and reads a value', () => {
    sessionStorageAdapter.write('k', 'v');
    expect(sessionStorageAdapter.read('k')).toBe('v');
  });
});

// --- urlHashAdapter ---
describe('urlHashAdapter', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('writes and reads back through the hash', () => {
    urlHashAdapter.write('any-key', 'hello world');
    expect(urlHashAdapter.read('any-key')).toBe('hello world');
  });

  it('returns null when hash is empty', () => {
    expect(urlHashAdapter.read('any-key')).toBeNull();
  });

  it('uses replaceState (not pushState)', () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    urlHashAdapter.write('k', 'v');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// --- createMemoryAdapter ---
describe('createMemoryAdapter', () => {
  it('two instances are isolated', () => {
    const a = createMemoryAdapter();
    const b = createMemoryAdapter();
    a.write('k', 'from-a');
    expect(b.read('k')).toBeNull();
  });

  it('delete removes the key', () => {
    const m = createMemoryAdapter();
    m.write('k', 'v');
    m.delete?.('k');
    expect(m.read('k')).toBeNull();
  });
});

// --- noneAdapter ---
describe('noneAdapter', () => {
  it('read always returns null', () => {
    expect(noneAdapter.read('anything')).toBeNull();
  });

  it('write is a no-op', () => {
    expect(() => noneAdapter.write('k', 'v')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `cd ~/src/labkit && npx vitest run src/state/adapters.test.ts`
Expected: module not found / multiple failures.

- [ ] **Step 3: Implement `adapters.ts`**

```ts
import type { StorageAdapter } from './types.js';
import { encodeUrlHash, decodeUrlHash } from './helpers.js';

// --- localStorage ---
export const localStorageAdapter: StorageAdapter = {
  read: (key) => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },
  write: (key, value) => {
    try { localStorage.setItem(key, value); }
    catch (e) { console.warn('[labkit] localStorage write failed:', e); }
  },
  delete: (key) => {
    try { localStorage.removeItem(key); }
    catch { /* ignore */ }
  },
};

// --- sessionStorage ---
export const sessionStorageAdapter: StorageAdapter = {
  read: (key) => {
    try { return sessionStorage.getItem(key); }
    catch { return null; }
  },
  write: (key, value) => {
    try { sessionStorage.setItem(key, value); }
    catch (e) { console.warn('[labkit] sessionStorage write failed:', e); }
  },
  delete: (key) => {
    try { sessionStorage.removeItem(key); }
    catch { /* ignore */ }
  },
};

// --- urlHash ---
// All keys share a single hash. The hash stores a base64-encoded JSON wrapper:
// { [key]: value }
const URL_HASH_GUARD = typeof window !== 'undefined';

function readHashMap(): Record<string, string> {
  if (!URL_HASH_GUARD) return {};
  const raw = decodeUrlHash(window.location.hash.replace(/^#/, ''));
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; }
  catch { return {}; }
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

// --- memory ---
export function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    read: (key) => store.get(key) ?? null,
    write: (key, value) => { store.set(key, value); },
    delete: (key) => { store.delete(key); },
  };
}

// --- none ---
export const noneAdapter: StorageAdapter = {
  read: () => null,
  write: () => {},
  delete: () => {},
};
```

- [ ] **Step 4: Run tests — confirm they all pass**

Run: `cd ~/src/labkit && npx vitest run src/state/adapters.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/src/labkit
git add src/state/adapters.ts src/state/adapters.test.ts
git commit -m "state: add storage adapters (localStorage, sessionStorage, urlHash, memory, none)"
```

---

## Task 4: Zustand store

**Files:**
- Create: `src/state/store.ts`
- Create: `src/state/store.test.ts`

- [ ] **Step 1: Write failing tests first (`store.test.ts`)**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLabStore } from './store.js';
import { createMemoryAdapter } from './adapters.js';
import { labStorageKey } from './helpers.js';

function makeStore(overrides?: Partial<Parameters<typeof createLabStore>[0]>) {
  return createLabStore({
    storageKey: 'test',
    storage: createMemoryAdapter(),
    ...overrides,
  });
}

describe('createLabStore — initial state', () => {
  it('starts with empty workspaces and saves', () => {
    const s = makeStore();
    expect(s.getState().workspaces).toEqual([]);
    expect(s.getState().savedSnapshots).toEqual([]);
  });

  it('uses initialTheme when provided', () => {
    const s = makeStore({ initialTheme: 'light' });
    expect(s.getState().theme).toBe('light');
  });

  it('defaults theme to auto', () => {
    const s = makeStore();
    expect(s.getState().theme).toBe('auto');
  });
});

describe('addWorkspace', () => {
  it('adds a workspace with an empty undoStack', () => {
    const s = makeStore();
    s.getState().addWorkspace({
      id: 'w1', instrumentName: 'Test',
      config: {}, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    expect(s.getState().workspaces).toHaveLength(1);
    expect(s.getState().workspaces[0]?.undoStack).toEqual({ past: [], future: [] });
  });
});

describe('removeWorkspace', () => {
  it('removes by id', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().removeWorkspace('w1');
    expect(s.getState().workspaces).toHaveLength(0);
  });
});

describe('updateWorkspaceState', () => {
  it('updates state with a plain value', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: { n: 0 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().updateWorkspaceState('w1', { n: 42 });
    expect(s.getState().workspaces[0]?.state).toEqual({ n: 42 });
  });

  it('updates state with an updater function', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: { n: 1 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().updateWorkspaceState('w1', (prev: unknown) => ({ n: (prev as { n: number }).n + 1 }));
    expect((s.getState().workspaces[0]?.state as { n: number }).n).toBe(2);
  });
});

describe('updateWorkspaceConfig', () => {
  it('updates a single config key', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: { x: 1, y: 2 }, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().updateWorkspaceConfig('w1', 'x' as never, 99 as never);
    expect((s.getState().workspaces[0]?.config as { x: number }).x).toBe(99);
    expect((s.getState().workspaces[0]?.config as { y: number }).y).toBe(2);
  });
});

describe('setTheme', () => {
  it('updates theme', () => {
    const s = makeStore();
    s.getState().setTheme('dark');
    expect(s.getState().theme).toBe('dark');
  });
});

describe('save/load/delete snapshots', () => {
  it('saveSnapshot creates a snapshot', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: { x: 1 }, state: { n: 5 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().saveSnapshot('w1', 'my save');
    const snaps = s.getState().savedSnapshots;
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.name).toBe('my save');
    expect(snaps[0]?.instrumentName).toBe('T');
  });

  it('loadSnapshot restores state and config', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: { x: 1 }, state: { n: 5 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().saveSnapshot('w1', 'snap1');
    s.getState().updateWorkspaceState('w1', { n: 99 });
    const snapId = s.getState().savedSnapshots[0]!.id;
    s.getState().loadSnapshot(snapId, 'w1');
    expect((s.getState().workspaces[0]?.state as { n: number }).n).toBe(5);
  });

  it('loadSnapshot blocks cross-instrument load', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'A', config: {}, state: { n: 1 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().saveSnapshot('w1', 'snap-a');
    s.getState().setWorkspaceInstrument('w1', 'B');
    const snapId = s.getState().savedSnapshots[0]!.id;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.getState().loadSnapshot(snapId, 'w1');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('deleteSnapshot removes the snapshot', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().saveSnapshot('w1', 'snap');
    const id = s.getState().savedSnapshots[0]!.id;
    s.getState().deleteSnapshot(id);
    expect(s.getState().savedSnapshots).toHaveLength(0);
  });

  it('listSnapshots returns newest first', () => {
    const s = makeStore();
    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().saveSnapshot('w1', 'first');
    s.getState().saveSnapshot('w1', 'second');
    const list = s.getState().listSnapshots('w1');
    expect(list[0]?.name).toBe('second');
  });
});

describe('persistence — hydration', () => {
  it('hydrates workspaces from storage on construction', () => {
    const mem = createMemoryAdapter();
    const key = labStorageKey('test', 'workspaces');
    // Pre-seed the adapter
    const seedStore = createLabStore({ storageKey: 'test', storage: mem });
    seedStore.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: { n: 7 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    // Flush is debounced — force it
    vi.useFakeTimers();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    // A new store reading the same adapter should see the workspace
    const hydrated = createLabStore({ storageKey: 'test', storage: mem });
    expect(hydrated.getState().workspaces).toHaveLength(1);
    expect((hydrated.getState().workspaces[0]?.state as { n: number }).n).toBe(7);
  });
});

describe('persistence — debounced writes', () => {
  it('multiple rapid mutations produce one write call', () => {
    vi.useFakeTimers();
    const mem = createMemoryAdapter();
    const writeSpy = vi.spyOn(mem, 'write');
    const s = createLabStore({ storageKey: 'test', storage: mem });

    s.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: {}, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    s.getState().updateWorkspaceState('w1', { n: 1 });
    s.getState().updateWorkspaceState('w1', { n: 2 });
    s.getState().updateWorkspaceState('w1', { n: 3 });

    const writesBefore = writeSpy.mock.calls.length;
    vi.advanceTimersByTime(400);
    const writesAfter = writeSpy.mock.calls.length;

    // Should be exactly 3 writes (workspaces, saves, theme) — one flush
    expect(writesAfter - writesBefore).toBe(3);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `cd ~/src/labkit && npx vitest run src/state/store.test.ts`
Expected: module not found / multiple failures.

- [ ] **Step 3: Implement `store.ts`**

Implement `createLabStore` using `zustand/vanilla`. Key requirements:
- Hydrate synchronously in the store initializer from all three buckets.
- Actions mutate state via `set()` and schedule a debounced flush (300 ms `setTimeout`).
- The flush calls `storage.write` for all three buckets.
- `saveSnapshot` deep-clones `config` via `structuredClone`; serializes `state` via registered serializer.
- `loadSnapshot` checks `instrumentName` match before restoring; warns and returns without change if mismatched.
- `listSnapshots` sorts by `savedAt` descending.
- Store instance exposes a `registerSerializers` method (not in Zustand state) for Plan 3 to call after construction.

The store shape is `LabStoreState & LabStoreActions & { registerSerializers(s: InstrumentSerializers): void }`.

Reference: `docs/superpowers/specs/2026-04-27-state-runtime-design.md` §3 for the full implementation pattern.

- [ ] **Step 4: Run tests — confirm they all pass**

Run: `cd ~/src/labkit && npx vitest run src/state/store.test.ts`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/src/labkit
git add src/state/store.ts src/state/store.test.ts
git commit -m "state: add createLabStore (Zustand vanilla store, persistence, save/load slots)"
```

---

## Task 5: React context providers

**Files:**
- Create: `src/state/context.tsx`

- [ ] **Step 1: Create `context.tsx`**

```tsx
import { createContext, useContext, type ReactNode, type ReactElement } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from './store.js';
import type { LabStoreState } from './types.js';

// ---- LabStoreContext ----

type LabStoreCtx = { store: LabStore } | null;

export const LabStoreContext = createContext<LabStoreCtx>(null);

export function LabStoreProvider({
  store,
  children,
}: {
  store: LabStore;
  children: ReactNode;
}): ReactElement {
  return (
    <LabStoreContext.Provider value={{ store }}>
      {children}
    </LabStoreContext.Provider>
  );
}

/** Hook to access the full store state + actions. Throws outside LabStoreProvider. */
export function useLabStore(): LabStoreState & ReturnType<LabStore['getState']> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useLabStore must be used inside <LabStoreProvider>');
  return useStore(ctx.store);
}

// ---- WorkspaceIdContext ----

export const WorkspaceIdContext = createContext<string | null>(null);

export function WorkspaceIdProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <WorkspaceIdContext.Provider value={workspaceId}>
      {children}
    </WorkspaceIdContext.Provider>
  );
}

export function useWorkspaceId(): string {
  const id = useContext(WorkspaceIdContext);
  if (!id) throw new Error('[labkit] useWorkspaceId must be used inside <WorkspaceIdProvider>');
  return id;
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd ~/src/labkit && npx tsc -b --noEmit`
Expected: exits with code 0.

- [ ] **Step 3: Commit**

```bash
cd ~/src/labkit
git add src/state/context.tsx
git commit -m "state: add LabStoreProvider and WorkspaceIdProvider React context"
```

---

## Task 6: `useExperimentState` hook

**Files:**
- Create: `src/state/useExperimentState.ts`
- Create: `src/state/useExperimentState.test.tsx`

- [ ] **Step 1: Write failing tests first (`useExperimentState.test.tsx`)**

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createLabStore } from './store.js';
import { createMemoryAdapter } from './adapters.js';
import { LabStoreProvider, WorkspaceIdProvider } from './context.js';
import { useExperimentState } from './useExperimentState.js';

type TestState = { count: number };
type TestConfig = { step: number };

function makeWrapper(workspaceId: string) {
  const store = createLabStore({ storageKey: 'test', storage: createMemoryAdapter() });
  store.getState().addWorkspace({
    id: workspaceId,
    instrumentName: 'Counter',
    config: { step: 1 } satisfies TestConfig,
    state: { count: 0 } satisfies TestState,
    view: { zoom: 1, pan: { x: 0, y: 0 } },
  });

  return {
    store,
    wrapper: ({ children }: { children: ReactNode }) => (
      <LabStoreProvider store={store}>
        <WorkspaceIdProvider workspaceId={workspaceId}>
          {children}
        </WorkspaceIdProvider>
      </LabStoreProvider>
    ),
  };
}

describe('useExperimentState', () => {
  it('returns the initial state and config', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useExperimentState<TestState, TestConfig>(), { wrapper });
    expect(result.current.state.count).toBe(0);
    expect(result.current.config.step).toBe(1);
  });

  it('setState (plain value) updates the store', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useExperimentState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setState({ count: 42 }));
    expect(result.current.state.count).toBe(42);
  });

  it('setState (updater) updates the store', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useExperimentState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setState((prev) => ({ count: prev.count + 10 })));
    expect(result.current.state.count).toBe(10);
  });

  it('setConfig updates a config key', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useExperimentState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setConfig('step', 5));
    expect(result.current.config.step).toBe(5);
  });

  it('sibling workspace does not re-render on unrelated workspace changes', () => {
    const store = createLabStore({ storageKey: 'test', storage: createMemoryAdapter() });
    store.getState().addWorkspace({ id: 'w1', instrumentName: 'T', config: {}, state: { n: 0 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });
    store.getState().addWorkspace({ id: 'w2', instrumentName: 'T', config: {}, state: { n: 0 }, view: { zoom: 1, pan: { x: 0, y: 0 } } });

    let w2RenderCount = 0;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <LabStoreProvider store={store}>
        <WorkspaceIdProvider workspaceId="w2">
          {children}
        </WorkspaceIdProvider>
      </LabStoreProvider>
    );

    renderHook(() => {
      w2RenderCount++;
      return useExperimentState();
    }, { wrapper });

    const countBefore = w2RenderCount;
    act(() => store.getState().updateWorkspaceState('w1', { n: 99 }));
    expect(w2RenderCount).toBe(countBefore); // w2 did not re-render
  });

  it('throws when used outside LabStoreProvider', () => {
    expect(() =>
      renderHook(() => useExperimentState()),
    ).toThrow('[labkit]');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `cd ~/src/labkit && npx vitest run src/state/useExperimentState.test.tsx`
Expected: module not found / multiple failures.

- [ ] **Step 3: Implement `useExperimentState.ts`**

```ts
import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { LabStoreContext, WorkspaceIdContext } from './context.js';
import type { ExperimentStateHandle } from './types.js';

export function useExperimentState<TS = unknown, TC = unknown>(): ExperimentStateHandle<TS, TC> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useExperimentState must be used inside <LabStoreProvider>');

  const workspaceId = useContext(WorkspaceIdContext);
  if (!workspaceId) throw new Error('[labkit] useExperimentState must be used inside <WorkspaceIdProvider>');

  const record = useStore(ctx.store, (s) =>
    s.workspaces.find((w) => w.id === workspaceId),
  );

  if (!record) throw new Error(`[labkit] No workspace found with id "${workspaceId}"`);

  const updateWorkspaceState = useStore(ctx.store, (s) => s.updateWorkspaceState);
  const updateWorkspaceConfig = useStore(ctx.store, (s) => s.updateWorkspaceConfig);

  return {
    state: record.state as TS,
    config: record.config as TC,
    setState: (next) => updateWorkspaceState(workspaceId, next as Parameters<typeof updateWorkspaceState>[1]),
    setConfig: (key, value) => updateWorkspaceConfig(workspaceId, key as never, value as never),
  };
}
```

- [ ] **Step 4: Run tests — confirm they all pass**

Run: `cd ~/src/labkit && npx vitest run src/state/useExperimentState.test.tsx`
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/src/labkit
git add src/state/useExperimentState.ts src/state/useExperimentState.test.tsx
git commit -m "state: add useExperimentState hook (workspace-scoped state + config handle)"
```

---

## Task 7: Public index + tsup entry point

**Files:**
- Create: `src/state/index.ts`
- Edit: `package.json` (add `./state` export entry)
- Edit: `tsup.config.ts` (add `src/state/index.ts` as an entry point)

- [ ] **Step 1: Create `src/state/index.ts`**

```ts
// Types
export type {
  WorkspaceRecord,
  UndoStack,
  SavedSnapshot,
  LabStoreState,
  StorageAdapter,
  ExperimentStateHandle,
  CreateLabStoreOptions,
  InstrumentSerializers,
} from './types.js';

// Store
export { createLabStore } from './store.js';
export type { LabStore, LabStoreActions } from './store.js';

// Context + hooks
export {
  LabStoreProvider,
  LabStoreContext,
  WorkspaceIdProvider,
  WorkspaceIdContext,
  useLabStore,
  useWorkspaceId,
} from './context.js';

// Hook
export { useExperimentState } from './useExperimentState.js';

// Adapters
export {
  localStorageAdapter,
  sessionStorageAdapter,
  urlHashAdapter,
  createMemoryAdapter,
  noneAdapter,
} from './adapters.js';

// Helpers (public for advanced use)
export {
  labStorageKey,
  encodeUrlHash,
  decodeUrlHash,
  emptyUndoStack,
  serializeWorkspaces,
  deserializeWorkspaces,
} from './helpers.js';
```

- [ ] **Step 2: Add `./state` export to `package.json`**

Add the following entry to the `"exports"` object in `package.json` (after the existing `"./primitives"` entry):

```json
"./state": {
  "types": "./dist/state/index.d.ts",
  "import": "./dist/state/index.js"
},
```

- [ ] **Step 3: Add `src/state/index.ts` as a tsup entry**

Edit `tsup.config.ts` to add `'src/state/index.ts'` to the `entry` array. The existing `src/index.ts` entry stays.

- [ ] **Step 4: Verify build**

Run: `cd ~/src/labkit && npm run build`
Expected: `dist/state/index.js` and `dist/state/index.d.ts` appear. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd ~/src/labkit
git add src/state/index.ts package.json tsup.config.ts
git commit -m "state: add public index, package.json export, and tsup entry for @labkit/react/state"
```

---

## Task 8: Smoke test — all tests + lint + build

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd ~/src/labkit && npm test`
Expected: all tests pass, no failures.

- [ ] **Step 2: Run lint**

Run: `cd ~/src/labkit && npm run lint`
Expected: biome check passes, class-prefix script passes (no `.tsx` in state/).

- [ ] **Step 3: Run full build**

Run: `cd ~/src/labkit && npm run build`
Expected: `dist/` contains `state/index.js`, `state/index.d.ts`; no errors.

- [ ] **Step 4: Verify exported types round-trip through the build**

Manually inspect `dist/state/index.d.ts` — confirm `WorkspaceRecord`, `StorageAdapter`, `useExperimentState`, `localStorageAdapter`, and `createLabStore` are all present.

- [ ] **Step 5: Tag and commit**

```bash
cd ~/src/labkit
git tag plan-2-state-runtime
git push --follow-tags   # only if remote is configured
```

---

## Appendix: Coverage targets

Per design spec §9 (testing), the 70%+ coverage target applies to all of `src/`. The state subsystem should exceed this. Key paths to keep covered:

| Module | Key scenarios to exercise |
|---|---|
| `helpers.ts` | All branches in deserializeWorkspaces (error, no serializer, with serializer) |
| `adapters.ts` | Error paths in localStorage/sessionStorage; SSR guard in urlHash |
| `store.ts` | Hydration on construction; debounce consolidation; cross-instrument load block |
| `useExperimentState.ts` | Outside-provider throw; sibling non-rerender |

Run coverage with: `cd ~/src/labkit && npx vitest run --coverage src/state/`
