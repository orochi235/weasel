# State Runtime — Design Spec

**Date:** 2026-04-27
**Status:** Draft (unattended Claude default — review before implementation)
**Depends on:** Plan 1 (Foundation) — shipped and tagged `plan-1-foundation`
**Builds toward:** Plan 3 (Lab/Workspace runtime)
**Package paths:** `src/state/`, `@labkit/react/state`

---

## 1. Summary

The state-runtime subsystem is the internal engine that powers every Lab. It owns the per-Lab Zustand store, the workspace state shape, storage adapters, persistence wiring, the `useExperimentState()` hook, and the save/load slot machinery. Everything in Plans 3–6 sits on top of this layer; nothing in this plan renders UI.

This subsystem is intentionally narrow: it manages *data* only. It does not render `<Lab>`, `<Workspace>`, or any chrome. It does not implement undo (that is Plan 5 — undo is a capability bolt-on). It does not define the full Instrument contract; it only holds what a workspace needs at runtime (`instrumentName`, `state`, `config`, `view`). The public surface is small: four exports from `src/state/index.ts` that Plans 3–5 import.

The design follows the contracts established in design spec §7 (State, Persistence, Undo) and the `StorageAdapter` interface mentioned in design spec §4. Type names are preserved exactly as written in the original spec. All state updates use fresh-state updaters — no Immer dependency.

---

## 2. Public API

All exports from `src/state/index.ts`, re-exported through the `@labkit/react/state` entry point.

### 2.1 Types

```ts
/** Mirrors design spec §7 exactly. undoStack is NOT persisted. */
interface WorkspaceRecord<TS = unknown, TC = unknown> {
  id: string;
  instrumentName: string;
  config: TC;
  state: TS;
  view: { zoom: number; pan: { x: number; y: number } };
  /** Session-only — never written to storage. Managed by Plan 5 (undo). */
  undoStack: UndoStack;
}

/** Opaque placeholder owned by Plan 5. State-runtime allocates but never mutates it. */
interface UndoStack {
  past: unknown[];
  future: unknown[];
}

/** Named save captured at a moment in time (design spec §7). */
interface SavedSnapshot {
  id: string;          // uuid v4
  name: string;        // user-facing label
  workspaceId: string;
  instrumentName: string;
  config: unknown;
  state: unknown;
  /** CLAUDE'S DEFAULT: view (zoom/pan) is NOT included in saves — only config+state. Rationale: view is navigation, not experimental result. Override if desired. */
  savedAt: number;     // Date.now()
}

/** The full shape of the per-Lab Zustand store. */
interface LabStoreState {
  workspaces: WorkspaceRecord[];
  savedSnapshots: SavedSnapshot[];
  /** Mirrors the <Lab theme> prop; persisted so the user's override survives refresh. */
  theme: 'light' | 'dark' | 'auto';
}

/** Storage adapter interface — design spec §7. Synchronous intentionally. */
interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  /** CLAUDE'S DEFAULT: delete is optional. Adapters that cannot delete (e.g. urlHash) ignore the call silently. */
  delete?(key: string): void;
}

/** Returned by useExperimentState(). */
interface ExperimentStateHandle<TS, TC> {
  state: TS;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  config: TC;
  setConfig: (key: keyof TC, value: TC[keyof TC]) => void;
}

/** Options passed to createLabStore. */
interface CreateLabStoreOptions {
  storageKey: string;
  storage: StorageAdapter;
  initialTheme?: 'light' | 'dark' | 'auto';
}

/** Token provided by LabStoreProvider — consumed by useExperimentState. */
type LabStoreContextValue = {
  store: LabStore;
  workspaceId: string | null;  // null at Lab level; set by WorkspaceProvider (Plan 3)
};
```

### 2.2 Store factory

```ts
/**
 * Creates an isolated Zustand store for one <Lab> instance.
 * Multiple Labs on one page each call this; stores do not share state.
 * The returned store is an opaque handle — consumers use hooks, not the store directly.
 */
function createLabStore(options: CreateLabStoreOptions): LabStore;

/** Opaque type; use LabStoreActions to interact. */
type LabStore = ReturnType<typeof createLabStore>;
```

### 2.3 Store actions (returned by `useLabStore()`)

```ts
interface LabStoreActions {
  // Workspace management
  addWorkspace(record: Omit<WorkspaceRecord, 'undoStack'>): void;
  removeWorkspace(id: string): void;
  updateWorkspaceState<TS>(id: string, next: TS | ((prev: TS) => TS)): void;
  updateWorkspaceConfig<TC>(id: string, key: keyof TC, value: TC[keyof TC]): void;
  updateWorkspaceView(id: string, view: WorkspaceRecord['view']): void;
  setWorkspaceInstrument(id: string, instrumentName: string): void;

  // Save slots
  saveSnapshot(workspaceId: string, name: string): void;
  loadSnapshot(snapshotId: string, workspaceId: string): void;
  deleteSnapshot(snapshotId: string): void;
  listSnapshots(workspaceId?: string): SavedSnapshot[];

  // Theme
  setTheme(theme: 'light' | 'dark' | 'auto'): void;
}
```

### 2.4 Context and hooks

```ts
/** Provider that makes a LabStore available to the tree. Used internally by <Lab> (Plan 3). */
function LabStoreProvider(props: {
  store: LabStore;
  workspaceId?: string;
  children: ReactNode;
}): ReactElement;

/** Hook — consumes the nearest LabStoreProvider. Throws if used outside one. */
function useLabStore(): LabStoreState & LabStoreActions;

/**
 * Workspace-scoped hook. Returns the experiment state handle for the
 * workspace ID set by the nearest WorkspaceProvider.
 * Throws if used outside a WorkspaceProvider.
 * See design spec §7.
 */
function useExperimentState<TS, TC>(): ExperimentStateHandle<TS, TC>;
```

### 2.5 Storage adapters

```ts
/** labkit.storage.localStorage — default */
const localStorageAdapter: StorageAdapter;

/** labkit.storage.sessionStorage */
const sessionStorageAdapter: StorageAdapter;

/**
 * labkit.storage.urlHash
 * Encodes the full lab state into the URL fragment as base64-encoded JSON.
 * CLAUDE'S DEFAULT: no compression (LZ-string or similar). The base64 URL can grow large
 * for complex states. Override decision: add compression if URL length becomes a concern.
 */
const urlHashAdapter: StorageAdapter;

/** labkit.storage.memory — for tests; in-memory Map, not shared across instances */
function createMemoryAdapter(): StorageAdapter;

/** labkit.storage.none — disables persistence; read always returns null, write is a no-op */
const noneAdapter: StorageAdapter;
```

### 2.6 Pure helpers

```ts
/** Build the namespaced storage key. Produces "lk:<storageKey>:workspaces" etc. */
function labStorageKey(storageKey: string, bucket: 'workspaces' | 'saves' | 'theme'): string;

/** Serialize workspace list for storage. Uses instrument.serialize if provided. */
function serializeWorkspaces(
  workspaces: WorkspaceRecord[],
  serializers: Record<string, ((state: unknown) => unknown) | undefined>,
): string;

/** Deserialize workspace list from storage. Uses instrument.deserialize if provided. */
function deserializeWorkspaces(
  raw: string,
  deserializers: Record<string, ((data: unknown) => unknown) | undefined>,
): WorkspaceRecord[];

/** URL hash codec — split out for independent unit testing. */
function encodeUrlHash(value: string): string;
function decodeUrlHash(hash: string): string | null;

/** Allocate an empty UndoStack. Used by addWorkspace. Plan 5 populates it. */
function emptyUndoStack(): UndoStack;
```

---

## 3. Internal Architecture

### 3.1 Zustand store shape

The store is created with `zustand/vanilla` (not the React hook form) so that it can be constructed outside of React and passed as a prop. The `LabStoreProvider` bridges it into React via `useStore` from `zustand/react`.

```ts
// Internal — not exported
const createLabStoreImpl = (options: CreateLabStoreOptions) =>
  createStore<LabStoreState & LabStoreActions>()((set, get) => ({
    workspaces: [],
    savedSnapshots: [],
    theme: options.initialTheme ?? 'auto',

    addWorkspace: (record) => {
      set((s) => ({
        workspaces: [...s.workspaces, { ...record, undoStack: emptyUndoStack() }],
      }));
      // triggers persistence flush (see §5)
    },

    updateWorkspaceState: (id, next) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === id
            ? { ...w, state: typeof next === 'function' ? (next as (p: unknown) => unknown)(w.state) : next }
            : w,
        ),
      }));
      // triggers persistence flush
    },

    // ... other actions follow the same pattern
  }));
```

The store does NOT hold undo history logic — it holds the `undoStack` field as an opaque `UndoStack`, and Plan 5 (undo) will wire its own middleware or actions on top.

### 3.2 Context wiring

Two React contexts are used:

1. **`LabStoreContext`** — holds `{ store: LabStore }`. Set once by `<Lab>` (Plan 3). Never changes after mount.
2. **`WorkspaceIdContext`** — holds the `workspaceId: string` for the current workspace tile. Set by each `<Workspace>` (Plan 3).

`useExperimentState()` reads both contexts: it gets the store from `LabStoreContext` and the workspace ID from `WorkspaceIdContext`. It subscribes to only the slice of state matching its workspace ID, avoiding re-renders in sibling workspaces.

```ts
// CLAUDE'S DEFAULT: useExperimentState subscribes via useStore(store, selector) where the
// selector picks the single WorkspaceRecord matching workspaceId. This means any state
// change in any workspace triggers the selector in all workspaces, but only produces a
// re-render when the selected record actually changed (Zustand's shallow equality default).
// Alternative: one store per workspace. Override if per-workspace isolation is needed.
```

### 3.3 Serializer registry

`createLabStore` accepts an internal `serializers` map that Plans 3/5 populate when instruments are registered. This map is `Record<instrumentName, { serialize?, deserialize? }>`. It is not part of the public `CreateLabStoreOptions` API — Plan 3 calls an internal setter after store creation. **CLAUDE'S DEFAULT:** the registry is a plain mutable object on the store instance, not Zustand state (it does not trigger re-renders when updated).

---

## 4. Storage Adapters

### 4.1 `StorageAdapter` interface

Synchronous by design (design spec §7). Async adapters (IndexedDB, remote) are out of scope for v0.

```ts
interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  delete?(key: string): void;
}
```

### 4.2 `localStorageAdapter`

Wraps `window.localStorage`. **CLAUDE'S DEFAULT:** `write` is wrapped in a try/catch; if `localStorage.setItem` throws (QuotaExceededError or SecurityError), the write silently fails and a `console.warn` is emitted. No retry, no eviction, no user-facing error. Override if the app should surface storage-full errors to users.

```ts
const localStorageAdapter: StorageAdapter = {
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
```

### 4.3 `sessionStorageAdapter`

Identical to `localStorageAdapter` but backed by `window.sessionStorage`. Same error-handling policy applies.

### 4.4 `urlHashAdapter`

Encodes the full serialized state (both buckets: `workspaces` + `saves`) into the URL fragment as a single base64-encoded JSON blob. The key argument is ignored — everything goes into `location.hash`.

**CLAUDE'S DEFAULT decisions:**
- No compression. Base64-only. URL length limit (~2KB in some browsers) may be exceeded for complex states.
- Both buckets share a single hash entry. The adapter merges them under a wrapper object `{ workspaces: string; saves: string }`.
- `read` parses `location.hash` on each call (no caching). Stale reads are not a concern because writes always update the hash synchronously.
- `delete` is a no-op (the hash cannot selectively delete one bucket without rewriting the whole thing).
- History entries: **CLAUDE'S DEFAULT:** `replaceState` is used (not `pushState`), so URL-hash persistence does not pollute browser history.

Edge cases:
- SSR / no-window: `urlHashAdapter` guards with `typeof window !== 'undefined'`; reads return `null`, writes are no-ops.
- Hash already contains non-labkit data: **CLAUDE'S DEFAULT:** If `decodeUrlHash` fails to parse the wrapper object, the whole hash is treated as empty (not an error) and the existing hash is overwritten on the next write.

### 4.5 `createMemoryAdapter()`

Returns a new adapter backed by a `Map<string, string>`. Each call returns a fresh, isolated map — safe for parallel test runs with `vitest`. No shared module-level state.

### 4.6 `noneAdapter`

`read` always returns `null`. `write` and `delete` are no-ops. Used when `storage={null}` is passed to `<Lab>` — Plan 3 normalizes `null` to `noneAdapter` before calling `createLabStore`.

---

## 5. Persistence Lifecycle

### 5.1 Read (hydration)

`createLabStore` performs a synchronous read from the storage adapter immediately upon construction, before the store is returned. This happens inside the `createLabStoreImpl` function body (not in an effect), so hydration is complete before the first render.

Hydration order:
1. Read `lk:<storageKey>:workspaces` → call `deserializeWorkspaces` with registered deserializers → populate `store.workspaces`
2. Read `lk:<storageKey>:saves` → JSON.parse → populate `store.savedSnapshots`
3. Read `lk:<storageKey>:theme` → populate `store.theme` (or fall back to `initialTheme`)

**CLAUDE'S DEFAULT:** If any bucket fails to parse (malformed JSON, schema mismatch), that bucket is silently dropped and the store starts with an empty value for that bucket. A `console.warn` is emitted. Override if hard errors are preferred.

### 5.2 Write (persistence flush)

Every action that mutates `workspaces`, `savedSnapshots`, or `theme` schedules a flush. **CLAUDE'S DEFAULT:** debounced at **300 ms** using a module-level `setTimeout` per store instance. If multiple actions fire within the debounce window, only one write occurs.

```ts
// CLAUDE'S DEFAULT: debounce delay = 300 ms.
// Alternative values: 0 (synchronous, safer for urlHash), 1000 ms (fewer writes for heavy state).
// For urlHashAdapter specifically, 0 ms may be preferred to keep the URL current on every change.
// Override the debounce delay via a future CreateLabStoreOptions.persistDebounceMs field.
```

Each flush writes all three buckets unconditionally. **CLAUDE'S DEFAULT:** no dirty-bit optimization (always writes all buckets on any change). Override if write performance is a concern.

### 5.3 `undoStack` is session-only

`serializeWorkspaces` strips `undoStack` before serializing. `deserializeWorkspaces` sets `undoStack: emptyUndoStack()` on each deserialized record. This is the persistence boundary defined in design spec §7.

### 5.4 Instrument serialize/deserialize integration

`serializeWorkspaces` accepts a `serializers` map:

```ts
// For each workspace:
const serializer = serializers[workspace.instrumentName]?.serialize;
const serializedState = serializer ? serializer(workspace.state) : workspace.state;
// Then JSON.stringify the whole record.
```

`deserializeWorkspaces` mirrors this with `deserialize`. **CLAUDE'S DEFAULT:** if a workspace's `instrumentName` is not in the serializers map (e.g., the instrument was unregistered), the raw JSON-parsed value is used as `state` without transformation. The workspace is retained in storage; no data is lost.

### 5.5 Race conditions

Synchronous adapters (`localStorage`, `sessionStorage`, `memory`) have no async race conditions. `urlHashAdapter` writes synchronously via `replaceState` — also no races. No async adapter is supported in v0.

**CLAUDE'S DEFAULT:** Multiple browser tabs sharing the same `storageKey` with `localStorage` will have their states diverge silently. The `storage` event is NOT listened to. Override if cross-tab sync is required.

---

## 6. `useExperimentState` Hook

### 6.1 Signature

```ts
function useExperimentState<TS, TC>(): ExperimentStateHandle<TS, TC>;
```

The generic parameters are cast, not inferred — the caller is responsible for passing the correct types, matching the Instrument's `TState`/`TConfig`. This mirrors how `useExperimentState` is called from inside an Instrument's `render` function (see design spec §5).

### 6.2 Implementation

```ts
function useExperimentState<TS, TC>(): ExperimentStateHandle<TS, TC> {
  const { store } = useContext(LabStoreContext);     // throws if missing
  const workspaceId = useContext(WorkspaceIdContext); // throws if missing

  const record = useStore(store, (s) =>
    s.workspaces.find((w) => w.id === workspaceId),
  );

  if (!record) throw new Error(`[labkit] No workspace found with id "${workspaceId}"`);

  const { updateWorkspaceState, updateWorkspaceConfig } = useStore(store, (s) => ({
    updateWorkspaceState: s.updateWorkspaceState,
    updateWorkspaceConfig: s.updateWorkspaceConfig,
  }));

  return {
    state: record.state as TS,
    config: record.config as TC,
    setState: (next) => updateWorkspaceState(workspaceId, next as TS | ((prev: TS) => TS)),
    setConfig: (key, value) => updateWorkspaceConfig(workspaceId, key as keyof unknown, value),
  };
}
```

### 6.3 Stability guarantees

**CLAUDE'S DEFAULT:** `setState` and `setConfig` are stable references (they come from Zustand's store, which never recreates action functions). The `state` and `config` values change only when their workspace's record changes. Components receiving `ExperimentStateHandle` from a parent do not need `useCallback` wrappers around the returned functions.

### 6.4 Calling outside a provider

Both context reads use a sentinel default value (`null`). If either is `null`, the hook throws a descriptive error immediately. This makes misconfiguration obvious during development.

---

## 7. Save Slots

### 7.1 Data shape

```ts
interface SavedSnapshot {
  id: string;          // crypto.randomUUID()
  name: string;        // user-facing label, e.g. "Best run" — max 64 chars
  workspaceId: string;
  instrumentName: string;
  config: unknown;     // deep-cloned at save time
  state: unknown;      // serialized via instrument.serialize if available
  savedAt: number;     // Date.now()
}
```

**CLAUDE'S DEFAULT:** `view` (zoom/pan) is NOT saved. Rationale: saves represent experimental results, not navigation state. Override if restoring zoom level is desired.

### 7.2 Operations

**`saveSnapshot(workspaceId, name)`**

1. Find the `WorkspaceRecord` for `workspaceId`.
2. Deep-clone `config` via `structuredClone`.
3. Serialize `state` via the registered `serialize` for `instrumentName` (fallback: `structuredClone`).
4. Append a new `SavedSnapshot` to `store.savedSnapshots`.
5. Trigger persistence flush.

**CLAUDE'S DEFAULT:** No maximum number of saves per workspace. Saves accumulate without limit. Override to add a per-workspace cap.

**`loadSnapshot(snapshotId, workspaceId)`**

1. Find the `SavedSnapshot` by `snapshotId`.
2. Find the `WorkspaceRecord` by `workspaceId`.
3. If `snapshot.instrumentName !== workspace.instrumentName`: **CLAUDE'S DEFAULT:** the load is blocked and a `console.warn` is emitted. The workspace is not modified. Override if cross-instrument restore is desired (e.g., after renaming an instrument).
4. Deserialize `snapshot.state` via the registered `deserialize` for `instrumentName` (fallback: identity).
5. Call `updateWorkspaceState(workspaceId, restoredState)` and update `config` via a direct store set.
6. Trigger persistence flush.

**`deleteSnapshot(snapshotId)`**

Remove the entry from `store.savedSnapshots`. Trigger persistence flush.

**`listSnapshots(workspaceId?)`**

Return a filtered (or full) array from `store.savedSnapshots`. Sorted by `savedAt` descending. **CLAUDE'S DEFAULT:** sorted newest-first.

### 7.3 Storage key

Saves persist under `lk:<storageKey>:saves`. The full `SavedSnapshot[]` is JSON-stringified as a single value.

### 7.4 Conflict handling

**CLAUDE'S DEFAULT:** No conflict detection. If two saves have the same `name`, both are kept. The UI (Plan 3) may warn the user about duplicate names, but the store does not enforce uniqueness.

---

## 8. Testing Strategy

### 8.1 Pure function tests (vitest, no DOM)

- `labStorageKey` — all three bucket variants
- `encodeUrlHash` / `decodeUrlHash` — round-trip, empty string, non-UTF8 characters, malformed input
- `serializeWorkspaces` / `deserializeWorkspaces` — with and without custom serializers; missing instrumentName in registry; undoStack stripped
- `emptyUndoStack` — shape check

### 8.2 Storage adapter tests (vitest, jsdom for localStorage/sessionStorage)

- `localStorageAdapter` — read/write/delete/QuotaExceededError handled gracefully
- `sessionStorageAdapter` — same matrix
- `urlHashAdapter` — encode/decode round-trip; replaceState called (spy); SSR guard (mock window away)
- `createMemoryAdapter()` — read/write/delete; two instances are isolated
- `noneAdapter` — read returns null; write/delete are no-ops

### 8.3 Store tests (`renderHook` or `createStore` directly)

- `createLabStore` — hydrates from adapter on construction
- `addWorkspace` → triggers persistence flush (spy on adapter.write)
- `updateWorkspaceState` — updater function form; flat value form
- `updateWorkspaceConfig`
- `saveSnapshot` — snapshot added; instrumentName matches
- `loadSnapshot` — state/config updated; cross-instrument load blocked
- `deleteSnapshot`
- `listSnapshots` — sorted newest-first; filtered by workspaceId
- `setTheme` — persisted
- Debounce: multiple rapid actions → one adapter.write call (**CLAUDE'S DEFAULT:** test with fake timers)

### 8.4 Hook tests (`renderHook` + real store)

- `useExperimentState` — returns correct state/config for workspace
- `setState` (value form) — updates store
- `setState` (updater form) — updates store
- `setConfig` — updates store
- Used outside provider — throws descriptive error
- Sibling workspace does not re-render when unrelated workspace state changes

---

## 9. Open Decisions (Claude Defaults — Please Review)

Each item is marked with what choice was made and why. Override any before implementation.

1. **CLAUDE'S DEFAULT — View not saved in snapshots.** Saves capture `{ instrumentName, config, state }` only. Zoom/pan is considered navigation, not data. Override: add `view` to `SavedSnapshot` and restore it on `loadSnapshot`.

2. **CLAUDE'S DEFAULT — Persistence debounce = 300 ms.** Balances write frequency against potential data loss on hard tab-close. For `urlHash` adapter, 0 ms may be preferable. Override: expose `persistDebounceMs` in `CreateLabStoreOptions`.

3. **CLAUDE'S DEFAULT — No URL hash compression.** Base64-encoded JSON only. Large states will produce long URLs. Override: integrate `lz-string` or `fflate` before the base64 step.

4. **CLAUDE'S DEFAULT — localStorage quota errors are silent (console.warn only).** No user-facing error; no eviction strategy. Override: surface errors via a callback in `CreateLabStoreOptions` (e.g., `onStorageError`).

5. **CLAUDE'S DEFAULT — Cross-instrument snapshot load is blocked.** Loading a snapshot into a workspace running a different instrument is a no-op + warning. Override: allow if instruments share compatible state shapes.

6. **CLAUDE'S DEFAULT — No save-slot count limit.** Saves accumulate indefinitely. Override: add `maxSavesPerWorkspace` to `CreateLabStoreOptions`.

7. **CLAUDE'S DEFAULT — Duplicate save names allowed.** The store does not enforce uniqueness. UI can warn; store does not prevent. Override: enforce uniqueness in `saveSnapshot` (throw or auto-suffix).

8. **CLAUDE'S DEFAULT — No cross-tab sync.** `storage` event is not listened to. Two tabs sharing a `storageKey` will diverge. Override: add a `storage` event listener that calls `hydrateFromStorage()` on external writes.

9. **CLAUDE'S DEFAULT — Serializer registry is mutable state on the store instance, not Zustand state.** Updates to the registry do not trigger re-renders. Override: make it Zustand state if dynamic instrument loading is needed.

10. **CLAUDE'S DEFAULT — Hydration failures drop the bucket silently.** Malformed JSON or schema mismatches result in an empty workspace list rather than a hard error. Override: add `onHydrationError` callback to `CreateLabStoreOptions`.

11. **CLAUDE'S DEFAULT — `useExperimentState` uses Zustand selector with a `.find()` call.** All workspaces share one store; the selector runs on every store update. For N > ~20 workspaces this may become a perf concern. Override: switch to per-workspace stores if this becomes measurable.

12. **CLAUDE'S DEFAULT — `urlHashAdapter` uses `replaceState`, not `pushState`.** Hash changes do not create browser history entries. Override: use `pushState` if undo-via-back-button is desired (but note: this conflicts with Plan 5 undo).

---

## 10. Out of Scope

- Undo/redo stack implementation (Plan 5)
- `<Lab>`, `<Workspace>`, `<LabShell>` components (Plan 3)
- `defineInstrument()` and the Instrument contract (Plan 3)
- `<ControlPanel>`, `<CanvasStack>`, `<LayerList>` (Plans 3–4)
- IndexedDB, remote, or async storage adapters (post-v0)
- Cross-tab / multi-window sync (post-v0)
- Import/export of saves as JSON files (post-v0)
- URL-hash compression (post-v0, noted as CLAUDE'S DEFAULT above)
- Conflict-resolution when two saves have the same name (UI concern; store is intentionally permissive)
