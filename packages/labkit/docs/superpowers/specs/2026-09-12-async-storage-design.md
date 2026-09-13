# Async, record-based lab storage

**Status: built on branch `labkit-async-storage`, not yet merged to `main`.**

For whoever works on labkit's persistence next. It answers: how a lab persists
itself to any substrate — IndexedDB, localStorage, the URL, a server — and how
two writers (two tabs, or a tab and a server) share one lab without one
silently discarding the other's work. It supersedes the storage half of
`2026-04-27-state-runtime-design.md` and the single-document layout of
`2026-08-22-versioned-lab-document-design.md`; migrations and quarantine carry
over unchanged.

## Why

The old `StorageAdapter` was `read(key): string | null` / `write(key, value)`.
A synchronous read rules out IndexedDB, OPFS and anything remote, and a string
value forces JSON onto substrates that store objects natively. A lab was also
one document, so any edit rewrote everything and one tab's write discarded
every unsaved change in another.

## The adapter

```ts
interface StorageAdapter {
  get(key: string): Promise<unknown>;               // undefined when absent
  list(prefix: string): Promise<[string, unknown][]>;
  set(key: string, value: unknown): Promise<void>;  // rejects when the write fails
  delete(key: string): Promise<void>;
  subscribe?(prefix: string, on: (changes: StorageChange[]) => void): () => void;
}
type StorageChange = [key: string, value: unknown | undefined];
```

Values are structured-clone values. `subscribe` reports writes made by someone
else — another tab, another adapter instance, a server — never the caller's own;
`undefined` means deleted.

| Adapter | Values | `subscribe` |
|---|---|---|
| `createIndexedDbAdapter()` / `indexedDbAdapter` | native | `BroadcastChannel` |
| `localStorageAdapter` | JSON per record; warns once per key when JSON would change a value | `storage` event |
| `sessionStorageAdapter` | JSON per record | none |
| `urlHashAdapter` | JSON | `hashchange` |
| `createMemoryAdapter(backing?)` | structured clone | adapters sharing one `backing` see each other |
| `noneAdapter` | stores nothing | none |

No remote adapter ships; the interface is shaped for one.

## Records

A lab with storage key `K` splits into records under `lk:<enc K>:`, where
`enc` is `encodeURIComponent`, so no key segment can contain `:` and one lab's
prefix can never parse another lab's records:

| Record | Holds |
|---|---|
| `meta` | `{ version, mode }` |
| `trial:<enc id>` | one serialized trial, plus `order: number` |
| `save:<enc id>` | one saved snapshot |
| `layout` | tile extents |
| `undock` | undocked panels |
| `value:lab:<enc name>` | a lab-scoped `usePersistedState` value |
| `value:trial:<enc id>:<enc name>` | a trial-scoped one |

A record that parses as none of these is ignored. Trial order is a number on
each trial rather than a shared list, so trials added concurrently in two tabs
both survive; ties break by id. A reorder renumbers every trial.

`CURRENT_DOCUMENT_VERSION` becomes 4. Version 4 changes where a lab is stored,
not its shape: the joined records form the same `LabDocument` as version 3, and
`meta.version` stamps it.

## The record cache

`openRecords({ storage, prefix })` lists the prefix once and holds every record
in memory. It is the only thing that talks to the adapter.

- **Writes** update memory at once, notify local listeners, and reach the
  adapter on a 300 ms debounce that never holds a write more than 1 s, so a
  long drag still saves as it goes. Queued writes go out immediately on
  `pagehide` and when the document becomes hidden.
- **Conflicts:** the newest write to a record wins. A change arriving through
  `subscribe` for a record with a write still queued here is ignored — the
  queued write lands after it and becomes the newest. Otherwise it replaces the
  record and notifies listeners.
- **Failures:** a rejected `set` warns and leaves the value in memory; the
  record's next change queues it again. A rejected `list` opens the cache empty
  with writing disabled, so it never overwrites what it could not read.
- `close()` sends queued writes and unsubscribes.

## The lab store

- `createLabStore({ initial?, initialMode?, serializers?, configDefaults? })`
  is synchronous and knows nothing about storage. Tests and unpersisted labs use
  it.
- `openLabStore({ storageKey, storage, ...same }): Promise<{ store, records, close }>`
  opens the record cache, joins the records into a document, migrates it, fills
  config defaults, builds the store, and binds the two:
  - **store → records:** a store subscription diffs each slice by reference and
    writes only what changed. Removing a trial deletes its record and its
    trial-scoped values. Every store update persists, including a bare
    `store.setState`.
  - **records → store:** another writer's change is applied into the store
    without being written back. A replaced trial loses its undo history in this
    tab, since that history describes a state that no longer exists.
- **Old data.** With no `meta` record, `openLabStore` reads the version-3
  `lk:<raw K>:doc` (or the four pre-document buckets), migrates it, writes the
  records, reads them back, and only then deletes the old keys. localStorage and
  sessionStorage parse a stored value as JSON and fall back to the raw string,
  so every existing lab loads. A document that fails to migrate is quarantined
  under `lk:<raw K>:quarantine`; if the quarantine write cannot be read back,
  persistence stays off. A `meta.version` above the current one opens the lab
  empty with persistence off.

## `<Lab>`, `SingletonExperimentProvider`, `<Persistence>`

- `<Lab storageKey="x">` persists to IndexedDB; if IndexedDB will not open,
  labkit warns and uses localStorage. `storage` picks another substrate and is a
  type error without `storageKey`. With no `storageKey`, nothing persists and the
  lab renders synchronously — there is nothing to load.
- With a `storageKey`, `<Lab fallback={…}>` renders until every record has
  loaded. The default fallback is the lab's empty shell.
- The open promise lives in a ref and a cleanup's close is deferred a microtask,
  so StrictMode's double mount opens the lab once.
- A `storageKey` or `storage` change after mount is ignored, with a dev warning.
- `SingletonExperimentProvider`: `storage` becomes optional; gains `fallback`.
- `<Persistence storageKey storage? fallback?>` mounts a record cache for a page
  with no lab.

## `usePersistedState`

`usePersistedState(name, initial, { scope? })` returns `[value, set]` like
`useState`. Inside a trial the default scope is the trial; `scope: 'lab'`, or no
trial, scopes it to the lab. Reads are synchronous because the provider loaded
everything first. Another writer's change re-renders it. A `null` or `undefined`
name, or no provider above it, makes it plain `useState` — so a component can
offer optional persistence and mount anywhere. Values are not part of trial
state, so snapshots ignore them.

`FloatingPanel` replaces `storageKey` (raw localStorage) with `persist`, which
goes through `usePersistedState`.

## Annotations

`AnnotationStorage.load` returns a promise. `<Lab>` waits for the marks of every
trial present at load; a trial added later shows an empty body until its marks
arrive. Marks kept in the trial's own record are unaffected.

## Breaking changes

`StorageAdapter`'s methods; `createLabStore` no longer takes storage;
`FloatingPanel`'s `storageKey`; `AnnotationStorage.load`;
`SingletonExperimentProvider` now renders its fallback before its children.
