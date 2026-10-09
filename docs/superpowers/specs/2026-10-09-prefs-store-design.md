# Prefs store: `@weasel-js/storage` and `@weasel-js/prefs`

**Status: designed 2026-10-09, not built.** Delete this file when the work merges.

For whoever implements the engine-level prefs store. It answers: where pref
values live, how they load and save, and how an app wires them to `PrefsForm`.

## Why

The engine ships a pref schema (core's `ToolPref*` types) and a form that edits
it (ui's `PrefsForm`), but no store. Every app writes its own:
`apps/draw/src/prefs.ts` holds about 200 lines of generic machinery (typed paths,
default fallback, write coalescing, a listener bus) around two lines of app
config, and it discards every user's prefs whenever its blob version changes.

Meanwhile labkit already has the store's core: `RecordCache`
(`packages/labkit/src/state/records.ts`) holds records in memory, writes behind on
a debounce, reports local and remote changes, and refuses to write over data it
could not read. The prefs store is a schema-aware layer over it.

## Packages

| Package | Contents |
|---|---|
| `@weasel-js/storage` (new) | `StorageAdapter`, the web-storage, IndexedDB, URL-hash, memory and none adapters, `defaultStorage`, `RecordCache` / `openRecords`, moved from `packages/labkit/src/state/`. No weasel deps, no React. |
| `@weasel-js/prefs` (new) | Schema types, renamed `ToolPref*` → `Pref*` with no aliases; `prefUnit`; the pure schema helpers from ui (`isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, `prefDisplayBounds`); the store; its hooks. Depends on `storage`, `quantity`, React. |
| `@weasel-js/core` | Depends on `prefs`; tools keep declaring `usePenTool.prefs: PrefGroup`. `src/tools/prefs.ts` goes. |
| `@weasel-js/ui` | Imports types and helpers from `prefs`. `prefRailItems` stays: it is the form's own model. |
| `@weasel-js/labkit` | Imports from `storage` and `prefs`. `usePersistedState`, `<Persistence>` and lab records stay. |

Moving the adapters must not strand existing lab data. `storage`'s
`indexedDbAdapter` and `defaultStorage` use database `'weasel'`; labkit keeps
its own `indexedDbAdapter` and `defaultStorage`, built with
`createIndexedDbAdapter({ database: 'labkit' })`, so existing labs open on the
data they have. The IndexedDB adapter's `BroadcastChannel` is named
`weasel-storage:<database>:<store>` (was `labkit:<database>:<store>`): a tab on
an older labkit and one on a newer one stop hearing each other until both
reload. Warning prefixes become `[storage]`.

`@weasel-js/ui` stops re-exporting the pref types and the moved helpers;
consumers import them from `@weasel-js/prefs`. labkit's `weasel-ui`
passthrough drops them the same way.

`StorageAdapter` gains an optional `listSync(prefix)`, implemented by the
web-storage and memory adapters; `openRecordsSync` uses it. `SyncStorageAdapter`
is `StorageAdapter` with `listSync` required.

## Storage model

One record per leaf, keyed `<prefix><dotted path>`, plus one reserved record,
`$version`. **No record means the leaf follows its schema default**, so a changed
default reaches every user who never touched that pref. Per-leaf records also let
two tabs editing different prefs both keep their edits.

## API

```ts
openPrefs<S extends PrefGroup>(schema: S, options: PrefsOptions): Promise<PrefsStore<S>>
openPrefsSync<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions & { storage: SyncStorageAdapter },
): PrefsStore<S>

interface PrefsOptions {
  storage: StorageAdapter;
  prefix: string;
  /** migrations[i] takes the records from version i to i + 1. */
  migrations?: PrefsMigration[];
  /** Validators for app-defined kinds, keyed by `kind`. */
  validators?: Record<string, PrefValidator>;
}

/** Mutates the record map in place: rename, transform, delete. Sync. */
type PrefsMigration = (records: Map<string, unknown>) => void;

/** The value to read, or `undefined` for "invalid, use the default". */
type PrefValidator = (stored: unknown, leaf: PrefLeaf) => unknown;

interface PrefsStore<S extends PrefGroup> {
  readonly schema: S;
  get<P extends PrefPath<S>>(path: P): PrefValueAt<S, P>;
  set<P extends PrefPath<S>>(path: P, value: PrefValueAt<S, P>): void;
  /** Delete the record at `path` and every record under it; no path, all. */
  reset(path?: string): void;
  /** A record exists: the leaf is pinned. */
  isSet(path: PrefPath<S>): boolean;
  /** Resolved nested tree. The same object until something changes. */
  values(): unknown;
  /** Leaves following their default. The same set until something changes. */
  unset(): ReadonlySet<string>;
  subscribe(fn: (changes: PrefChange[]) => void): () => void;
  readonly writable: boolean;
  flush(): Promise<void>;
  close(): Promise<void>;
}

interface PrefChange { path: string; value: unknown; origin: 'local' | 'remote' }
```

`PrefPath<S>` and `PrefValueAt<S, P>` generalize draw's `WeaselDrawPrefPath` /
`PrefValueAt` over any schema.

`flattenPrefValues(schema, tree): [path, value][]` walks a nested value tree by
the schema's leaves; draw's legacy import uses it.

### Behavior

- **The version is `migrations.length`.** Adding a migration is the bump; there is
  no hand-set number. On open, migrations from the stored `$version` up run in
  order over the record map, the results are written, and `$version` is updated.
  This is the one case where opening writes.
- **Repair on read, never on write, never written back.** `get` and `values()`
  repair what they return; storage keeps the original until someone sets that
  leaf, so a schema rollback recovers it. Built-in kinds:
  - `number`: clamp into `min`..`max`; non-number → default.
  - `enum`: value not among the options → default.
  - `boolean`, `string`, `color`: wrong JS type → default.
  - kind changed so the stored value no longer fits → default.
  - a kind with no built-in rule and no validator passes through unchanged.
- **`set` does not validate**, and setting a leaf to its default still pins it.
  Only `reset` returns a leaf to following its default.
- **`set` on a leaf the schema does not have** is a type error; at runtime it
  warns and does nothing.
- **Remote changes** come from the adapter's `subscribe` through `RecordCache`
  (web storage via the `storage` event, IndexedDB via `BroadcastChannel`) and
  reach `subscribe` listeners with `origin: 'remote'`.

### Errors

| Failure | Result |
|---|---|
| Storage unreadable on open | Read-only, every leaf at its default (`openRecords`'s behavior). |
| Stored `$version` > `migrations.length` | Read-only; warning names both versions. |
| A migration throws | Nothing from it is written; read-only on the pre-migration records; warning. |
| A validator throws | Treated as invalid → default. |
| A write fails | `RecordCache`'s existing write path. |

### Hooks

- `usePref(store, path)` → `[value, set]`.
- `usePrefsValues(store)` → `{ values, set, unset, reset }`.

Both use `useSyncExternalStore`. The store is an explicit argument, not context:
a context type erases the schema's typed paths.

Wiring the form:

```tsx
const { values, set, unset, reset } = usePrefsValues(store);
<PrefsDialog
  schema={store.schema}
  values={values}
  onChange={set}
  auto={unset}
  onAutoChange={(path, next) => (next ? reset(path) : set(path, store.get(path)))}
/>
```

## Draw's migration

- Opens with `openPrefsSync(PREFS, { storage: localStorageAdapter, prefix: 'weaseldraw.prefs.' })`,
  keeping its pre-mount reads.
- After opening, if `weaseldraw.prefs.v2` exists: `flattenPrefValues` it, `set`
  each leaf, remove the old key. This is app code because migrations only see
  records under the prefix.
- `apps/draw/src/prefs.ts` shrinks to the schema; `usePref` / `readPref` /
  `writePref` / `usePrefsValues` call sites move to the store and its hooks.
- `WeaselDrawPref*` aliases follow the rename to `Pref*`.

## Tests

- `storage`: labkit's adapter tests move with the adapters, including the shared
  `adapterContract.ts` suite, plus a `listSync` case for the adapters having it.
- `prefs`, against the memory adapter: defaults; repair per built-in kind; custom
  validators, including one that throws; migrations in order; each read-only case
  in the table; remote changes reaching subscribers; `values()` and `unset()`
  keeping identity until a change; `reset` of a subtree; the hooks through
  `renderHook` and `act` (the store notifies synchronously, so `renderSettled` is
  not needed).
- draw: `prefs.test.ts` and `panels.test.ts` rewritten against the store; the
  legacy-blob import.
- Repo checks: both packages join the changesets `fixed` group;
  `check:manifests`, `check:test-projects` and `test:smoke:consumer` cover the new
  edges. Changesets are `patch`; their prose says the `ToolPref*` → `Pref*`
  rename is breaking.
