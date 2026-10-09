# Prefs Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-10-09, not started.** Delete this file, and the spec beside it, when the work merges.

**Goal:** An engine-level prefs store: `@weasel-js/storage` (the adapters and `RecordCache`, moved out of labkit) under `@weasel-js/prefs` (the schema, moved out of core, plus a store and hooks), with apps/draw as the first app on it.

**Architecture:** Spec: `docs/superpowers/specs/2026-10-09-prefs-store-design.md`. The store is a schema-aware layer over labkit's existing `RecordCache`: one record per leaf, reads repaired against the schema and served from a cached snapshot, writes passed straight to the cache, migrations run once on open.

**Tech Stack:** TypeScript, React 18+ (`useSyncExternalStore`), vitest (jsdom, `fake-indexeddb`), tsup, npm workspaces, changesets.

---

## Ground rules for every task

- Work in a worktree: `git worktree add ../weasel-prefs-store -b prefs-store`, then `npm ci` inside it before building or testing anything (a worktree without its own `node_modules` builds against the main checkout's). Every path below is relative to that worktree.
- Commit by path: `git commit -m "…" -- <paths>`. Never `git add -A`.
- Commit subjects are imperative and plain (`move the storage adapters out of labkit`), and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test projects: new packages' tests (`packages/storage`, `packages/prefs`) run under the `weasel-ui` vitest project; labkit under `labkit`; core under `core`; draw under `draw`. Run vitest from the repo root — from inside a package it finds zero files and looks like a pass.
- Only run the tests named in a step. The full suite goes to the fleet (`onto test`) after merge, not locally.
- **Path rule.** A group's key is a segment of its leaves' paths (`view.gridDensity`); an `object` leaf is one leaf, and its `children` are not separate paths. That is how `PrefsForm` and draw address prefs, and the store follows it. ⚠️ `PrefObject`'s doc comment in core claims group keys do not contribute to the path "at the top level" — that matches `SelectionPanel`'s node-property schemas, not `PrefsForm`. Do not "fix" the store toward that comment; Task 12 files the inconsistency.

## File map

| File | Role |
|---|---|
| `packages/storage/{package.json,tsconfig.json,tsup.config.ts,README.md,LICENSE}` | new package scaffold |
| `packages/storage/src/types.ts` | `StorageAdapter`, `SyncStorageAdapter`, `StorageChange` |
| `packages/storage/src/adapters.ts` | moved from labkit; adds `listSync`, `fallbackStorage` |
| `packages/storage/src/urlHash.ts` | `encodeUrlHash` / `decodeUrlHash`, moved from labkit `helpers.ts` |
| `packages/storage/src/records.ts` | moved from labkit; adds `openRecordsSync` |
| `packages/storage/src/adapterContract.ts` | moved shared adapter test suite |
| `packages/storage/src/{adapters,records,urlHash}.test.ts` | moved tests |
| `packages/storage/src/index.ts` | barrel |
| `packages/labkit/src/state/labStorage.ts` | labkit's own `indexedDbAdapter` / `defaultStorage` on database `'labkit'` |
| `packages/prefs/{package.json,tsconfig.json,tsup.config.ts,README.md,LICENSE}` | new package scaffold |
| `packages/prefs/src/schema.ts` (+ `.test.ts`) | moved from `packages/core/src/tools/prefs.ts`, renamed `ToolPref*` → `Pref*` |
| `packages/prefs/src/helpers.ts` (+ `.test.ts`) | tree helpers moved from ui, plus `setPrefValueAtPath`, `prefLeaves`, `flattenPrefValues` |
| `packages/prefs/src/paths.ts` (+ `.test.ts`) | `PrefPath`, `PrefAtPath`, `PrefValueOf`, `PrefValueAt` |
| `packages/prefs/src/repair.ts` (+ `.test.ts`) | `repairPrefValue`, `PrefValidator` |
| `packages/prefs/src/store.ts` (+ `.test.ts`) | `createPrefsStore`, `PrefsStore`, `PrefChange` |
| `packages/prefs/src/migrate.ts` (+ `.test.ts`) | `runPrefsMigrations`, `PrefsMigration` |
| `packages/prefs/src/open.ts` (+ `.test.ts`) | `openPrefs`, `openPrefsSync`, `PrefsOptions` |
| `packages/prefs/src/hooks.ts` (+ `.test.tsx`) | `usePref`, `usePrefsValues` |
| `packages/prefs/src/index.ts` | barrel |
| `apps/draw/src/prefs.ts` | shrinks to schema + store wiring + legacy import |

---

### Task 0: Worktree and spec amendments

Three details the spec left open are settled here; the spec must say so before code depends on them.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-prefs-store-design.md`

- [ ] **Step 1: Create the worktree and install**

```bash
cd /Users/mike/src/weasel
git worktree add ../weasel-prefs-store -b prefs-store
cd ../weasel-prefs-store
npm ci
```

- [ ] **Step 2: Amend the spec's "Packages" section**

Replace the paragraph beginning "Moving the adapters must not strand existing lab data" with:

```markdown
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
```

- [ ] **Step 3: Amend the spec's hook test line**

In "Tests", replace `the hooks through \`renderSettled\`` with `the hooks through \`renderHook\` and \`act\` (the store notifies synchronously, so \`renderSettled\` is not needed)`.

- [ ] **Step 4: Commit**

```bash
git commit -m "settle the storage defaults, channel name, and ui re-exports in the prefs store spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/specs/2026-10-09-prefs-store-design.md
```

---

### Task 1: Scaffold `@weasel-js/storage` and move the adapters into it

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/tsconfig.json`, `packages/storage/tsup.config.ts`, `packages/storage/README.md`, `packages/storage/LICENSE`, `packages/storage/src/types.ts`, `packages/storage/src/urlHash.ts`, `packages/storage/src/urlHash.test.ts`, `packages/storage/src/index.ts`
- Move: `packages/labkit/src/state/{adapters.ts,adapters.test.ts,adapterContract.ts,records.ts,records.test.ts}` → `packages/storage/src/`
- Modify: `tsconfig.json` (paths, include), `package.json` (`build:leaves`), `.changeset/config.json`, `typedoc/categories.mjs`

- [ ] **Step 1: Write the package scaffold**

`packages/storage/package.json`:

```json
{
  "name": "@weasel-js/storage",
  "version": "1.9.2",
  "description": "Keyed async storage behind one adapter interface — IndexedDB, localStorage, the URL hash, memory — and an in-memory record cache that writes behind and hears other tabs. No React, no weasel deps.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },
  "author": "orochi235",
  "homepage": "https://orochi235.github.io/weasel/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/orochi235/weasel.git",
    "directory": "packages/storage"
  },
  "bugs": {
    "url": "https://github.com/orochi235/weasel/issues"
  },
  "engines": {
    "node": ">=22"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

Before committing, check the current lockstep version with `node -p "require('./packages/react/package.json').version"` and use that instead of `1.9.2` if it differs.

`packages/storage/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

`packages/storage/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(packagePreset({ entry: { index: 'src/index.ts' } }));
```

`packages/storage/LICENSE`: `cp packages/react/LICENSE packages/storage/LICENSE`.

`packages/storage/README.md`:

```markdown
# @weasel-js/storage

Keyed storage behind one async interface, `StorageAdapter`, with adapters for
IndexedDB, `localStorage`, `sessionStorage`, the URL hash and memory.
`openRecords` loads every record under a prefix into a `RecordCache`: reads
are synchronous from memory, writes land in memory at once and reach storage
on a debounce, and changes other tabs make arrive as `remote` changes.

Adapters that can read synchronously (`localStorage`, `sessionStorage`,
memory) also implement `listSync`, and `openRecordsSync` opens a cache from
one with no `await`.
```

- [ ] **Step 2: Move the files with history**

```bash
mkdir -p packages/storage/src
for f in adapters.ts adapters.test.ts adapterContract.ts records.ts records.test.ts; do
  git mv packages/labkit/src/state/$f packages/storage/src/$f
done
```

- [ ] **Step 3: Split out the types**

Create `packages/storage/src/types.ts` by cutting `StorageChange` and `StorageAdapter` (with their doc comments) out of `packages/labkit/src/state/types.ts` (currently around lines 110–127), and adding the sync variant:

```ts
/** A change someone else made to one record: its new value, or `undefined`
 *  when it was deleted. */
export type StorageChange = [key: string, value: unknown];

/** Asynchronous keyed storage of structured-clone values, so IndexedDB, the
 *  URL, memory or a server can all back one. */
export interface StorageAdapter {
  /** `undefined` when the key is absent. */
  get(key: string): Promise<unknown>;
  list(prefix: string): Promise<[string, unknown][]>;
  /** Every record under `prefix`, read without waiting. Only substrates that
   *  can answer synchronously implement it. */
  listSync?(prefix: string): [string, unknown][];
  /** Rejects when the value did not land. */
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** Reports writes under `prefix` made by anyone but this adapter — another
   *  tab, another instance, a server. Omit when the substrate cannot tell. */
  subscribe?(prefix: string, on: (changes: StorageChange[]) => void): () => void;
}

/** An adapter `openRecordsSync` can open. */
export type SyncStorageAdapter = StorageAdapter & Required<Pick<StorageAdapter, 'listSync'>>;
```

In `packages/labkit/src/state/types.ts`, add at the top: `import type { StorageAdapter } from '@weasel-js/storage';` (only if the file still references `StorageAdapter` after the cut — check with `grep -n StorageAdapter packages/labkit/src/state/types.ts`).

- [ ] **Step 4: Move the URL-hash helpers**

Cut `encodeUrlHash` and `decodeUrlHash` from `packages/labkit/src/state/helpers.ts` into `packages/storage/src/urlHash.ts`, unchanged:

```ts
/** Encode a string for the URL fragment. */
export function encodeUrlHash(value: string): string {
  return btoa(encodeURIComponent(value));
}

/** Decode a URL fragment written by `encodeUrlHash`, or `null` if it is
 *  malformed. */
export function decodeUrlHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
}
```

Move their test cases from `packages/labkit/src/state/helpers.test.ts` (the `describe` block(s) exercising `encodeUrlHash`/`decodeUrlHash`) into `packages/storage/src/urlHash.test.ts`, importing from `./urlHash`.

- [ ] **Step 5: Fix imports inside the moved files**

```bash
cd packages/storage/src
sed -i '' "s#from './helpers'#from './urlHash'#" adapters.ts adapters.test.ts
grep -n "from '" adapters.ts records.ts adapterContract.ts adapters.test.ts records.test.ts
cd -
```

Every relative import must now resolve inside `packages/storage/src` (`./types`, `./urlHash`, `./adapters`, `./records`, `./adapterContract`). Any import of something still in labkit is a bug in the move — stop and look.

- [ ] **Step 6: Rename the warning prefixes and the channel**

```bash
cd packages/storage/src
sed -i '' 's/\[labkit\]/[storage]/g' adapters.ts records.ts
sed -i '' 's/`labkit:${database}:${store}`/`weasel-storage:${database}:${store}`/' adapters.ts
sed -i '' "s/database = 'labkit'/database = 'weasel'/; s#/\*\* Default \`'labkit'\`. \*/#/** Default \`'weasel'\`. */#" adapters.ts
grep -n "labkit" adapters.ts records.ts adapterContract.ts
cd -
```

Expected: the final grep prints only comment text you then reword by hand (for example "What a lab given only a `storageKey` persists to" on `defaultStorage` becomes "IndexedDB, or localStorage — with a warning — where IndexedDB will not open."). No `labkit` should remain in code.

- [ ] **Step 7: Replace `defaultStorage` with a reusable probe**

In `packages/storage/src/adapters.ts`, replace the block from `let resolvedDefault` through `resetDefaultStorage` with:

```ts
/** `preferred` if it opens, otherwise `fallback` — with a warning. */
export async function fallbackStorage(
  preferred: StorageAdapter,
  fallback: StorageAdapter = localStorageAdapter,
): Promise<StorageAdapter> {
  try {
    await preferred.list(' ');
    return preferred;
  } catch (error) {
    console.warn('[storage] IndexedDB would not open; persisting to localStorage instead', error);
    return fallback;
  }
}

let resolvedDefault: Promise<StorageAdapter> | null = null;

/** IndexedDB under the default database, or localStorage where it will not
 *  open. Resolved once per page. */
export function defaultStorage(): Promise<StorageAdapter> {
  resolvedDefault ??= fallbackStorage(indexedDbAdapter);
  return resolvedDefault;
}

/** Forget which default was chosen. Tests only. */
export function resetDefaultStorage(): void {
  resolvedDefault = null;
}
```

The existing `defaultStorage` tests in `adapters.test.ts` keep passing unchanged against this.

- [ ] **Step 8: Write the barrel**

`packages/storage/src/index.ts`:

```ts
export {
  createIndexedDbAdapter,
  createMemoryAdapter,
  defaultStorage,
  fallbackStorage,
  type IndexedDbAdapterOptions,
  indexedDbAdapter,
  localStorageAdapter,
  noneAdapter,
  resetDefaultStorage,
  sessionStorageAdapter,
  urlHashAdapter,
} from './adapters';
export {
  createRecordCache,
  openRecords,
  type OwnedRecordCache,
  type RecordCache,
  type RecordCacheOptions,
  type RecordChange,
} from './records';
export type { StorageAdapter, StorageChange, SyncStorageAdapter } from './types';
export { decodeUrlHash, encodeUrlHash } from './urlHash';
```

`adapterContract.ts` is test-only and stays out of the barrel.

- [ ] **Step 9: Register the package**

- `tsconfig.json` `paths`: add `"@weasel-js/storage": ["./packages/storage/src/index.ts"],` next to `@weasel-js/quantity`.
- `tsconfig.json` `include`: add `"packages/storage/src"` after `"packages/quantity/src"`.
- `package.json` `build:leaves`: insert `-w @weasel-js/storage` immediately after `-w @weasel-js/react` (order matters: the list builds in sequence).
- `.changeset/config.json` `fixed[0]`: add `"@weasel-js/storage"` after `"@weasel-js/quantity"`.
- `typedoc/categories.mjs`: add `['packages/storage/src', 'Extension points'],` under "Sibling packages the barrel re-exports wholesale", in alphabetical position.

Vite and vitest aliases need nothing: `scripts/vite-aliases.ts` discovers packages from `packages/`.

- [ ] **Step 10: Run the moved tests**

Run: `npx vitest run --project=weasel-ui packages/storage`
Expected: PASS — the contract suite for each adapter, the records tests, the URL-hash tests, and both `defaultStorage` cases. labkit is now broken (it imports the moved files); Task 3 fixes it.

- [ ] **Step 11: Commit**

```bash
git add packages/storage
git commit -m "move the storage adapters and record cache out of labkit into a storage package

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/storage packages/labkit/src/state tsconfig.json package.json .changeset/config.json typedoc/categories.mjs
```

---

### Task 2: `listSync` and `openRecordsSync`

**Files:**
- Modify: `packages/storage/src/adapters.ts`, `packages/storage/src/records.ts`, `packages/storage/src/adapterContract.ts`, `packages/storage/src/index.ts`
- Test: `packages/storage/src/adapterContract.ts`, `packages/storage/src/records.test.ts`

- [ ] **Step 1: Add the contract case**

In `adapterContract.ts`, inside `describeAdapterContract`'s `describe`, add:

```ts
    it('lists synchronously the same records it lists asynchronously, where it can', async () => {
      const { adapter } = harness();
      if (!adapter.listSync) return;
      await adapter.set('sync:a', 1);
      await adapter.set('sync:b', { x: 2 });
      await adapter.set('other', 3);
      const sorted = (rows: [string, unknown][]) => [...rows].sort(([a], [b]) => a.localeCompare(b));
      expect(sorted(adapter.listSync('sync:'))).toEqual(sorted(await adapter.list('sync:')));
      expect(sorted(adapter.listSync('sync:'))).toEqual([['sync:a', 1], ['sync:b', { x: 2 }]]);
    });
```

Use whatever name the suite already gives its harness factory (read the top of `describeAdapterContract` first; it takes `(name, make)` and calls the factory per case).

Add one more case asserting which adapters implement it, in `adapters.test.ts`:

```ts
describe('listSync', () => {
  it('exists exactly on the adapters that can read without waiting', () => {
    expect(localStorageAdapter.listSync).toBeTypeOf('function');
    expect(sessionStorageAdapter.listSync).toBeTypeOf('function');
    expect(createMemoryAdapter().listSync).toBeTypeOf('function');
    expect(createIndexedDbAdapter({ database: 'no-sync' }).listSync).toBeUndefined();
    expect(urlHashAdapter.listSync).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/storage/src/adapters.test.ts`
Expected: FAIL on the `listSync` describe (`expected undefined to be type of function`).

- [ ] **Step 3: Implement `listSync`**

In `webStorageAdapter`, pull the body of `list` into a local function and use it for both:

```ts
  const listNow = (prefix: string): [string, unknown][] => {
    const store = area();
    const out: [string, unknown][] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key === null || !key.startsWith(prefix)) continue;
      const raw = store.getItem(key);
      if (raw !== null) out.push([key, parse(raw)]);
    }
    return out;
  };
```

and in the adapter object: `list: async (prefix) => listNow(prefix),` and `listSync: listNow,`.

In `createMemoryAdapter`, read its current `list` implementation and do the same: extract the synchronous body to `listNow`, then `list: async (prefix) => listNow(prefix)` and `listSync: listNow`. Keep whatever cloning the existing `list` does (the contract's `binary` case depends on it).

- [ ] **Step 4: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/storage/src/adapters.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the `openRecordsSync` tests**

Append to `records.test.ts`:

```ts
describe('openRecordsSync', () => {
  it('holds every record under the prefix, names stripped, with no await', () => {
    const backing = new Map<string, unknown>([['p.a', 1], ['p.b', 2], ['q.c', 3]]);
    const cache = openRecordsSync({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(cache.writable).toBe(true);
    expect(cache.entries().sort()).toEqual([['a', 1], ['b', 2]]);
  });

  it('opens empty and read-only when the synchronous read throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {
      ...createMemoryAdapter(),
      listSync: () => {
        throw new Error('no');
      },
    };
    const cache = openRecordsSync({ storage, prefix: 'p.' });
    expect(cache.writable).toBe(false);
    expect(cache.entries()).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('writes through to the adapter', async () => {
    const backing = new Map<string, unknown>();
    const cache = openRecordsSync({ storage: createMemoryAdapter(backing), prefix: 'p.' });
    cache.set('a', 5);
    await cache.flush();
    expect(backing.get('p.a')).toBe(5);
  });
});
```

Add `openRecordsSync` to the file's import from `./records` and `createMemoryAdapter` from `./adapters` if not already imported; add `vi` to the vitest import if missing.

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run --project=weasel-ui packages/storage/src/records.test.ts`
Expected: FAIL — `openRecordsSync` is not exported.

- [ ] **Step 7: Implement `openRecordsSync`**

In `records.ts`, add `SyncStorageAdapter` to the type import from `./types`, then after `openRecords`:

```ts
/** `openRecords` for an adapter that reads synchronously: the cache is ready
 *  on return. A failed read opens it empty with writing off. */
export function openRecordsSync(
  options: RecordCacheOptions & { storage: SyncStorageAdapter },
): OwnedRecordCache {
  let listed: [string, unknown][];
  try {
    listed = options.storage.listSync(options.prefix);
  } catch (error) {
    console.warn(
      `[storage] could not read "${options.prefix}"; opening empty and not persisting`,
      error,
    );
    return createRecordCache({ ...options, writable: false });
  }
  return createRecordCache({
    ...options,
    initial: listed.map(([key, value]): [string, unknown] => [key.slice(options.prefix.length), value]),
  });
}
```

Export it from `index.ts` beside `openRecords`.

- [ ] **Step 8: Run to see it pass**

Run: `npx vitest run --project=weasel-ui packages/storage`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git commit -m "add synchronous listing to the web-storage and memory adapters, and openRecordsSync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/storage
```

---

### Task 3: labkit consumes `@weasel-js/storage`

**Files:**
- Create: `packages/labkit/src/state/labStorage.ts`
- Modify: `packages/labkit/package.json`, `packages/labkit/src/state/index.ts`, `packages/labkit/src/index.ts`, `packages/labkit/src/state/helpers.ts`, every labkit file importing the moved modules (list in Step 1)

- [ ] **Step 1: List the importers**

Run:

```bash
grep -rlnE "from '(\./|\.\./|\.\./\.\./)(state/)?(adapters|records|adapterContract)'|encodeUrlHash|decodeUrlHash|StorageAdapter|StorageChange" packages/labkit/src packages/labkit/examples
```

Expected (as of 2026-10-09): `index.ts`, `lab/Lab.tsx`, `lab/openLab.ts`, `lab/*.test.tsx`, `lab/openLab.test.ts`, `primitives/FloatingPanel.{stories,test}.tsx`, `state/{index,document,openLabStore,Persistence,SingletonExperiment,types,helpers}.ts(x)` and their tests, `trial/Trial.annotations.persist.test.tsx`.

- [ ] **Step 2: Give labkit its own default storage**

`packages/labkit/src/state/labStorage.ts`:

```ts
import { createIndexedDbAdapter, fallbackStorage, type StorageAdapter } from '@weasel-js/storage';

/** IndexedDB under labkit's own database, where every lab before
 *  `@weasel-js/storage` existed kept its records. */
export const indexedDbAdapter: StorageAdapter = createIndexedDbAdapter({ database: 'labkit' });

let resolvedDefault: Promise<StorageAdapter> | null = null;

/** What a lab given only a `storageKey` persists to: IndexedDB, or
 *  localStorage — with a warning — where IndexedDB will not open. */
export function defaultStorage(): Promise<StorageAdapter> {
  resolvedDefault ??= fallbackStorage(indexedDbAdapter);
  return resolvedDefault;
}

/** Forget which default was chosen. Tests only. */
export function resetDefaultStorage(): void {
  resolvedDefault = null;
}
```

- [ ] **Step 3: Rewrite the imports**

For each file from Step 1:
- `defaultStorage`, `indexedDbAdapter`, `resetDefaultStorage` → `from './labStorage'` (or the right relative path to `state/labStorage`).
- every other adapter, `openRecords`, `createRecordCache`, `RecordCache`, `OwnedRecordCache`, `RecordChange`, `StorageAdapter`, `StorageChange`, `encodeUrlHash`, `decodeUrlHash` → `from '@weasel-js/storage'`.
- `describeAdapterContract` is no longer reachable from labkit; if a labkit test used it, it moved with `adapters.test.ts` already — delete the stray import.

`packages/labkit/src/state/index.ts`: replace the `./adapters` export block, the `encodeUrlHash`/`decodeUrlHash` names in the `./helpers` block, `export type { RecordCache, RecordChange } from './records'`, and `StorageAdapter`/`StorageChange` in the `./types` block with named re-exports (never `export *` — see CLAUDE.md's barrel trap):

```ts
export {
  createIndexedDbAdapter,
  createMemoryAdapter,
  decodeUrlHash,
  encodeUrlHash,
  type IndexedDbAdapterOptions,
  localStorageAdapter,
  noneAdapter,
  type RecordCache,
  type RecordChange,
  sessionStorageAdapter,
  type StorageAdapter,
  type StorageChange,
  urlHashAdapter,
} from '@weasel-js/storage';
export { indexedDbAdapter } from './labStorage';
```

Then check `packages/labkit/src/index.ts` with `grep -n "adapters\|records\|StorageAdapter\|UrlHash" packages/labkit/src/index.ts` and route each name the same way.

- [ ] **Step 4: Declare the dependency**

`packages/labkit/package.json` `dependencies`: add `"@weasel-js/storage": "<lockstep version>"` in alphabetical position.

- [ ] **Step 5: Run labkit's tests**

Run: `npx vitest run --project=labkit packages/labkit/src/state packages/labkit/src/lab packages/labkit/src/trial packages/labkit/src/primitives`
Expected: PASS. A failure asserting a `[labkit]` warning text from a moved module means the assertion should now say `[storage]`; anything else is a broken import.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. (The `TS6059` errors from `tsc -p packages/core/tsconfig.json` are pre-existing and not part of `npm run typecheck`.)

- [ ] **Step 7: Commit**

```bash
git commit -m "import storage adapters and the record cache from the storage package in labkit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/labkit
```

---

### Task 4: Scaffold `@weasel-js/prefs` and move the schema into it

**Files:**
- Create: `packages/prefs/{package.json,tsconfig.json,tsup.config.ts,README.md,LICENSE}`, `packages/prefs/src/helpers.ts`, `packages/prefs/src/helpers.test.ts`, `packages/prefs/src/index.ts`
- Move: `packages/core/src/tools/prefs.ts` → `packages/prefs/src/schema.ts`; `packages/core/src/tools/prefs.test.ts` → `packages/prefs/src/schema.test.ts`
- Modify: `packages/core/src/tools/index.ts`, `packages/core/package.json`, `packages/ui/src/components/Prefs/schema.ts`, `packages/ui/src/components/Prefs/index.ts`, `packages/ui/src/index.ts`, `packages/ui/package.json`, `packages/labkit/src/passthrough/weasel-ui.ts`, `packages/labkit/package.json`, `tsconfig.json`, `package.json`, `.changeset/config.json`, `typedoc/categories.mjs`, and every file in the rename sweep (Step 6)

- [ ] **Step 1: Scaffold**

Copy Task 1 Step 1's `package.json`, `tsconfig.json`, `LICENSE` pattern with these differences:

```json
  "name": "@weasel-js/prefs",
  "description": "A preferences schema, a store that loads, validates, migrates and persists values against it, and React hooks over the store.",
  "repository": { "type": "git", "url": "git+https://github.com/orochi235/weasel.git", "directory": "packages/prefs" },
  "dependencies": {
    "@weasel-js/quantity": "<lockstep version>",
    "@weasel-js/storage": "<lockstep version>"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
```

`packages/prefs/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(packagePreset({ entry: { index: 'src/index.ts' }, external: ['react'] }));
```

`packages/prefs/README.md`:

````markdown
# @weasel-js/prefs

A preferences schema — groups of typed leaves with names, defaults and
rendering hints — and a store that keeps values for it.

```ts
const store = await openPrefs(SCHEMA, { storage: indexedDbAdapter, prefix: 'myapp.prefs.' });
store.get('view.gridVisible');
store.set('view.gridVisible', false);
```

One record per leaf. A leaf with no record follows its schema default. Reads
repair stored values that no longer fit the schema without writing them back.
`migrations[i]` takes stored records from version `i` to `i + 1`.
`openPrefsSync` opens from an adapter that reads synchronously, such as
`localStorageAdapter`, with no `await`.

`usePref(store, path)` and `usePrefsValues(store)` bind it to React;
`usePrefsValues` returns exactly what `@weasel-js/ui`'s `PrefsForm` takes.
````

- [ ] **Step 2: Move the schema with history**

```bash
mkdir -p packages/prefs/src
git mv packages/core/src/tools/prefs.ts packages/prefs/src/schema.ts
git mv packages/core/src/tools/prefs.test.ts packages/prefs/src/schema.test.ts
sed -i '' "s#from './prefs'#from './schema'#" packages/prefs/src/schema.test.ts
sed -i '' 's#^// src/tools/prefs.ts#// @weasel-js/prefs schema#' packages/prefs/src/schema.ts
```

Rewrite `schema.ts`'s header comment, which says "the kit ships no storage or UI of its own" (no longer true):

```ts
// The preferences schema: groups of typed leaves. Tools declare theirs as a
// `PrefGroup`; apps compose them into one registry, which `PrefsForm` renders
// and `openPrefs` stores.
```

- [ ] **Step 3: Move the tree helpers out of ui**

Cut these from `packages/ui/src/components/Prefs/schema.ts` into `packages/prefs/src/helpers.ts`, unchanged: `prefDisplayBounds`, `isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, and the private `prefLeafMatches` it uses. Leave in ui: `prefUnitAccepts`, `PrefRailItem`, `countPrefLeaves`, `prefRailItems`. Delete ui's whole `export type { ToolPref as BuiltinPref, … } from '@weasel-js/core'` alias block.

`helpers.ts` imports: `import type { PrefGroup, PrefLeaf, PrefNumber } from './schema';` (the names after Step 6's rename — write them that way now).

ui's `schema.ts` now imports what it still uses: `import { isPrefLeaf, type PrefGroup, type PrefLeaf, type PrefNumberUnit } from '@weasel-js/prefs';`.

Move the tests covering the moved helpers from ui's test files into `packages/prefs/src/helpers.test.ts`: run `grep -ln "filterPrefSubtree\|visiblePrefSubtree\|prefValueAtPath\|prefDisplayBounds\|isPrefLeaf" packages/ui/src` and move each `describe` that tests one of these functions directly (not a component test that happens to use one).

- [ ] **Step 4: Write the barrel**

`packages/prefs/src/index.ts`:

```ts
export {
  filterPrefSubtree,
  isPrefLeaf,
  prefDisplayBounds,
  prefValueAtPath,
  visiblePrefSubtree,
} from './helpers';
export {
  isBuiltinPref,
  PREF_KINDS,
  pairRowsOf,
  prefUnit,
  type BuiltinPref,
  type PrefBase,
  type PrefBoolean,
  type PrefBooleanControl,
  type PrefBooleanEncoding,
  type PrefColor,
  type PrefCustom,
  type PrefEnum,
  type PrefEnumControl,
  type PrefEnumEncoding,
  type PrefField,
  type PrefGroup,
  type PrefKind,
  type PrefLeaf,
  type PrefNumber,
  type PrefNumberControl,
  type PrefNumberUnit,
  type PrefObject,
  type PrefPaint,
  type PrefPair,
  type PrefString,
  type PrefStringControl,
} from './schema';
```

Check the moved `schema.ts` for any other exported name (`grep -n "^export" packages/prefs/src/schema.ts`) and add it here too; core's old `tools/index.ts` export list (lines 9–33) is the reference.

- [ ] **Step 5: Register the package**

Same edits as Task 1 Step 9, for `@weasel-js/prefs`:
- `tsconfig.json` `paths` `"@weasel-js/prefs": ["./packages/prefs/src/index.ts"],`; `include` `"packages/prefs/src"`.
- `package.json` `build:leaves`: insert `-w @weasel-js/prefs` after `-w @weasel-js/quantity` (it needs `storage` and `quantity` built first, and `storage` is already earlier in the list).
- `.changeset/config.json`: `"@weasel-js/prefs"` after `"@weasel-js/storage"`.
- `typedoc/categories.mjs`: `['packages/prefs/src', 'Extension points'],`.
- `packages/core/package.json`, `packages/ui/package.json`, `packages/labkit/package.json` `dependencies`: add `"@weasel-js/prefs": "<lockstep version>"`.

- [ ] **Step 6: Rename `ToolPref*` → `Pref*` across the repo**

The mapping, in the order the sed applies it:

| Old | New |
|---|---|
| `TOOL_PREF_KINDS` | `PREF_KINDS` |
| `isBuiltinToolPref` | `isBuiltinPref` |
| `ToolPref` (the bare built-in union) | `BuiltinPref` |
| `ToolPref<Suffix>` (every other: `ToolPrefGroup`, `ToolPrefLeaf`, …) | `Pref<Suffix>` |

```bash
FILES=$(grep -rlE "ToolPref|TOOL_PREF_KINDS|isBuiltinToolPref" packages apps --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v /dist/)
echo "$FILES"
sed -i '' -E \
  -e 's/\bTOOL_PREF_KINDS\b/PREF_KINDS/g' \
  -e 's/\bisBuiltinToolPref\b/isBuiltinPref/g' \
  -e 's/\bToolPref\b/BuiltinPref/g' \
  -e 's/\bToolPref([A-Z][A-Za-z]*)\b/Pref\1/g' \
  $FILES
grep -rnE "ToolPref|TOOL_PREF" packages apps --include='*.ts' --include='*.tsx' --include='*.md' | grep -v node_modules | grep -v /dist/ | grep -v CHANGELOG
```

macOS `sed -E` does not support `\b`; if the substitutions do nothing, run the same expressions through `perl -pi -e` instead (`perl -pi -e 's/\bToolPref([A-Z]\w*)\b/Pref$1/g'`). Expected: the final grep prints only prose in `.md` files (and docs/specs, which you leave alone unless they are current reference docs — `docs/conventions.md`, `docs/taxonomy.md`: update those).

Then fix import sources: every file that imported any of these names `from '@weasel-js/core'` must import them `from '@weasel-js/prefs'`. Files that imported them from `@weasel-js/ui` likewise. Inside core, `tools/builtin/pen/usePenTool.ts` and `tools/builtin/text/useTextTool.ts` import `from '../../prefs'` today — change to `from '@weasel-js/prefs'`.

Two collisions to resolve by hand:
- `packages/ui/src/components/Prefs/index.ts` and `packages/ui/src/index.ts` re-export the moved types and helpers. Remove those names; keep `prefRailItems`, `PrefRailItem`, `prefFieldProps`, `PrefFieldState`, the components and their props.
- `packages/labkit/src/passthrough/weasel-ui.ts` mirrors ui's exports. Remove the same names (`BuiltinPref`, `isPrefLeaf`, `Pref*` types, `visiblePrefSubtree`, `filterPrefSubtree`, `prefValueAtPath`, `prefDisplayBounds`).

Then remove the old export block from `packages/core/src/tools/index.ts` (the `./prefs` lines 9–33 as of 2026-10-09). Core does not re-export the prefs package.

- [ ] **Step 7: Typecheck until clean**

Run: `npm run typecheck`
Expected: exit 0. Each remaining error is an import still pointing at `@weasel-js/core`/`@weasel-js/ui` for a moved name; repoint it at `@weasel-js/prefs`.

- [ ] **Step 8: Run the affected tests**

```bash
npx vitest run --project=weasel-ui packages/prefs packages/ui/src/components/Prefs packages/ui/src/components/PrefSchemaEditor packages/ui/src/components/SelectionPanel packages/ui/src/components/ToolOptionsBar
npx vitest run --project=core packages/core/src/canvas/SceneCanvas packages/core/src/tools
npx vitest run --project=labkit packages/labkit/src/config packages/labkit/src/controls packages/labkit/src/passthrough
npx vitest run --project=draw apps/draw/src/prefs.test.ts
```

Expected: PASS for all four.

- [ ] **Step 9: Commit**

```bash
git add packages/prefs
git commit -m "move the pref schema out of core into a prefs package, renaming ToolPref* to Pref*

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages apps tsconfig.json package.json .changeset/config.json typedoc/categories.mjs docs/conventions.md docs/taxonomy.md
```

(Drop the `docs/*` paths from the command if Step 6 changed neither.)

---

### Task 5: Path types and value-tree helpers

**Files:**
- Create: `packages/prefs/src/paths.ts`, `packages/prefs/src/paths.test.ts`
- Modify: `packages/prefs/src/helpers.ts`, `packages/prefs/src/helpers.test.ts`, `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/paths.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { PrefAtPath, PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './schema';

const SCHEMA = {
  name: 'Test',
  children: {
    loose: { kind: 'boolean', name: 'Loose', description: '', default: true },
    view: {
      name: 'View',
      children: {
        density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
        grid: {
          name: 'Grid',
          children: {
            color: { kind: 'color', name: 'Color', description: '', default: '#ccc' },
          },
        },
      },
    },
    fill: {
      kind: 'enum',
      name: 'Fill',
      description: '',
      default: 'nonzero',
      options: [
        { value: 'nonzero', label: 'Nonzero' },
        { value: 'evenodd', label: 'Even-odd' },
      ],
    },
    custom: { kind: 'registry-enum', name: 'Custom', description: '', default: 'select' as string },
  },
} satisfies PrefGroup;

describe('PrefPath', () => {
  it('names every leaf by its dotted path, group keys included', () => {
    expectTypeOf<PrefPath<typeof SCHEMA>>().toEqualTypeOf<
      'loose' | 'view.density' | 'view.grid.color' | 'fill' | 'custom'
    >();
  });
});

describe('PrefAtPath', () => {
  it('finds the leaf at a nested path', () => {
    expectTypeOf<PrefAtPath<typeof SCHEMA, 'view.grid.color'>['kind']>().toEqualTypeOf<'color'>();
  });
});

describe('PrefValueAt', () => {
  it('types built-in kinds by kind and app-defined kinds by their default', () => {
    expectTypeOf<PrefValueAt<typeof SCHEMA, 'loose'>>().toEqualTypeOf<boolean>();
    expectTypeOf<PrefValueAt<typeof SCHEMA, 'view.density'>>().toEqualTypeOf<number>();
    expectTypeOf<PrefValueAt<typeof SCHEMA, 'view.grid.color'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<typeof SCHEMA, 'custom'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<typeof SCHEMA, 'fill'>>().toMatchTypeOf<string>();
  });
});
```

Append to `helpers.test.ts`:

```ts
import { flattenPrefValues, prefLeaves, setPrefValueAtPath } from './helpers';

const TREE_SCHEMA: PrefGroup = {
  name: 'Test',
  children: {
    a: { kind: 'number', name: 'A', description: '', default: 1 },
    g: {
      name: 'G',
      children: {
        b: { kind: 'boolean', name: 'B', description: '', default: false },
        o: {
          kind: 'object',
          name: 'O',
          description: '',
          default: {},
          children: { x: { kind: 'number', name: 'X', description: '', default: 0 } },
        },
      },
    },
  },
};

describe('prefLeaves', () => {
  it('maps each leaf path to its leaf, stopping at object leaves', () => {
    expect([...prefLeaves(TREE_SCHEMA).keys()]).toEqual(['a', 'g.b', 'g.o']);
  });
});

describe('setPrefValueAtPath', () => {
  it('returns a new root with the value set, creating branches and sharing nothing it changed', () => {
    const root = { g: { b: true }, keep: { z: 1 } };
    const next = setPrefValueAtPath(root, 'g.c.d', 5);
    expect(next).toEqual({ g: { b: true, c: { d: 5 } }, keep: { z: 1 } });
    expect(root).toEqual({ g: { b: true }, keep: { z: 1 } });
    expect(next.keep).toBe(root.keep);
    expect(next.g).not.toBe(root.g);
  });
});

describe('flattenPrefValues', () => {
  it('lists each leaf present in the tree as a path and value, skipping absent ones', () => {
    expect(flattenPrefValues(TREE_SCHEMA, { a: 2, g: { o: { x: 3 } }, stray: 9 })).toEqual([
      ['a', 2],
      ['g.o', { x: 3 }],
    ]);
  });
});
```

(Merge these imports into the file's existing import lines rather than adding a second import from `./helpers`; add `type PrefGroup` from `./schema` if absent.)

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/paths.test.ts packages/prefs/src/helpers.test.ts`
Expected: FAIL — `./paths` does not exist; `prefLeaves`, `setPrefValueAtPath`, `flattenPrefValues` are not exported.

Type assertions only fail under the typecheck: also run `npm run typecheck` and expect errors in `paths.test.ts`.

- [ ] **Step 3: Implement the path types**

`packages/prefs/src/paths.ts`:

```ts
type Join<A extends string, B extends string> = A extends '' ? B : `${A}.${B}`;

/** Every leaf's dotted path in a schema. A group's key is a segment; an
 *  `object` leaf is one path, its fields are not. */
export type PrefPath<G, Prefix extends string = ''> =
  G extends { children: infer C }
    ? {
        [K in keyof C & string]: C[K] extends { kind: string }
          ? Join<Prefix, K>
          : C[K] extends { children: Record<string, unknown> }
            ? PrefPath<C[K], Join<Prefix, K>>
            : never;
      }[keyof C & string]
    : never;

/** The leaf at `P`. */
export type PrefAtPath<G, P extends string> =
  G extends { children: infer C }
    ? P extends `${infer H}.${infer Rest}`
      ? H extends keyof C
        ? PrefAtPath<C[H], Rest>
        : never
      : P extends keyof C
        ? C[P] extends { kind: string }
          ? C[P]
          : never
        : never
    : never;

/** What a leaf holds: its kind's value type for a built-in kind, the type of
 *  its `default` for an app-defined one. */
export type PrefValueOf<L> =
  L extends { kind: 'number' } ? number
  : L extends { kind: 'boolean' } ? boolean
  : L extends { kind: 'string' | 'color' | 'field' } ? string
  : L extends { kind: 'enum'; options: readonly { value: infer T }[] } ? T
  : L extends { default: infer D } ? D
  : unknown;

/** What the leaf at `P` holds. */
export type PrefValueAt<G, P extends string> = PrefValueOf<PrefAtPath<G, P>>;
```

- [ ] **Step 4: Implement the helpers**

Append to `packages/prefs/src/helpers.ts`:

```ts
/** Every leaf under `schema`, by dotted path, in schema order. */
export function prefLeaves(schema: PrefGroup): Map<string, PrefLeaf> {
  const out = new Map<string, PrefLeaf>();
  const walk = (group: PrefGroup, prefix: string): void => {
    for (const [key, child] of Object.entries(group.children)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (isPrefLeaf(child)) out.set(path, child);
      else walk(child, path);
    }
  };
  walk(schema, '');
  return out;
}

/** `root` with `value` at the dotted `path`: a new object along the path,
 *  every untouched branch shared. Missing or non-object segments become
 *  objects. */
export function setPrefValueAtPath<T extends Record<string, unknown>>(
  root: T,
  path: string,
  value: unknown,
): T {
  const parts = path.split('.');
  const out: Record<string, unknown> = { ...root };
  let cursor = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i]!;
    const next = cursor[seg];
    const branch: Record<string, unknown> =
      next !== null && typeof next === 'object' ? { ...(next as Record<string, unknown>) } : {};
    cursor[seg] = branch;
    cursor = branch;
  }
  cursor[parts[parts.length - 1]!] = value;
  return out as T;
}

/** Each of `schema`'s leaves that `tree` holds a value for, as a path and
 *  that value — the inverse of building a tree from per-leaf records. */
export function flattenPrefValues(schema: PrefGroup, tree: unknown): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const path of prefLeaves(schema).keys()) {
    const value = prefValueAtPath(tree, path);
    if (value !== undefined) out.push([path, value]);
  }
  return out;
}
```

Export from `index.ts`: add `flattenPrefValues`, `prefLeaves`, `setPrefValueAtPath` to the `./helpers` block, and:

```ts
export type { PrefAtPath, PrefPath, PrefValueAt, PrefValueOf } from './paths';
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/paths.test.ts packages/prefs/src/helpers.test.ts && npm run typecheck`
Expected: PASS, typecheck exit 0. If `'fill'`'s value type comes out as the literal union rather than `string`, `toMatchTypeOf<string>` still passes — leave it.

- [ ] **Step 6: Commit**

```bash
git commit -m "add schema path types, prefLeaves, setPrefValueAtPath, and flattenPrefValues to prefs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs
```

---

### Task 6: Repair on read

**Files:**
- Create: `packages/prefs/src/repair.ts`, `packages/prefs/src/repair.test.ts`
- Modify: `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/repair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { repairPrefValue } from './repair';
import type { PrefLeaf } from './schema';

const num = (extra: object = {}): PrefLeaf =>
  ({ kind: 'number', name: 'N', description: '', default: 10, min: 0, max: 100, ...extra }) as PrefLeaf;
const en: PrefLeaf = {
  kind: 'enum',
  name: 'E',
  description: '',
  default: 'a',
  options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
} as PrefLeaf;

describe('repairPrefValue', () => {
  it('clamps a number into min..max', () => {
    expect(repairPrefValue(num(), 150)).toBe(100);
    expect(repairPrefValue(num(), -5)).toBe(0);
    expect(repairPrefValue(num(), 42)).toBe(42);
  });

  it('defaults a number that is not one', () => {
    expect(repairPrefValue(num(), '42')).toBe(10);
    expect(repairPrefValue(num(), Number.NaN)).toBe(10);
    expect(repairPrefValue(num(), null)).toBe(10);
  });

  it('keeps infinity only at an endless end', () => {
    expect(repairPrefValue(num({ endless: 'max' }), Infinity)).toBe(Infinity);
    expect(repairPrefValue(num({ endless: 'max' }), -Infinity)).toBe(0);
    expect(repairPrefValue(num(), Infinity)).toBe(100);
    expect(repairPrefValue(num({ max: undefined }), Infinity)).toBe(10);
  });

  it('defaults an enum value no option has', () => {
    expect(repairPrefValue(en, 'b')).toBe('b');
    expect(repairPrefValue(en, 'gone')).toBe('a');
  });

  it('passes an encoded enum or boolean through, since its stored form is not the option', () => {
    const encoded = { ...en, encoding: { read: () => 'a', write: () => 'x' } } as PrefLeaf;
    expect(repairPrefValue(encoded, [4, 2])).toEqual([4, 2]);
    const flag = {
      kind: 'boolean', name: 'F', description: '', default: false,
      encoding: { read: () => true, write: () => 'italic' },
    } as PrefLeaf;
    expect(repairPrefValue(flag, 'italic')).toBe('italic');
  });

  it('defaults a boolean, string or color of the wrong type', () => {
    const b = { kind: 'boolean', name: 'B', description: '', default: true } as PrefLeaf;
    const s = { kind: 'string', name: 'S', description: '', default: 'x' } as PrefLeaf;
    const c = { kind: 'color', name: 'C', description: '', default: '#000' } as PrefLeaf;
    expect(repairPrefValue(b, 'yes')).toBe(true);
    expect(repairPrefValue(s, 4)).toBe('x');
    expect(repairPrefValue(c, '#fff')).toBe('#fff');
    expect(repairPrefValue(c, 0xffffff)).toBe('#000');
  });

  it('passes kinds it has no rule for through unchanged', () => {
    const custom = { kind: 'registry-enum', name: 'R', description: '', default: 'select' } as PrefLeaf;
    const stored = { anything: true };
    expect(repairPrefValue(custom, stored)).toBe(stored);
  });

  it('lets a validator decide, with undefined and a throw both meaning the default', () => {
    const custom = { kind: 'registry-enum', name: 'R', description: '', default: 'select' } as PrefLeaf;
    const validators = {
      'registry-enum': (stored: unknown) => (stored === 'pen' ? 'pen' : undefined),
    };
    expect(repairPrefValue(custom, 'pen', validators)).toBe('pen');
    expect(repairPrefValue(custom, 'gone', validators)).toBe('select');
    const throwing = { 'registry-enum': () => { throw new Error('no'); } };
    expect(repairPrefValue(custom, 'pen', throwing)).toBe('select');
  });

  it('lets a validator override a built-in kind', () => {
    expect(repairPrefValue(num(), 150, { number: (v) => v })).toBe(150);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/repair.test.ts`
Expected: FAIL — `./repair` does not exist.

- [ ] **Step 3: Implement**

`packages/prefs/src/repair.ts`:

```ts
import type { PrefBoolean, PrefEnum, PrefLeaf, PrefNumber } from './schema';

/** Decides what a stored value reads as for one kind of leaf: the value to
 *  read, or `undefined` for "invalid, read the default". */
export type PrefValidator = (stored: unknown, leaf: PrefLeaf) => unknown;

/** What `stored` reads as for `leaf`. Never writes anything back: a schema
 *  rolled back finds the original still in storage. */
export function repairPrefValue(
  leaf: PrefLeaf,
  stored: unknown,
  validators?: Readonly<Record<string, PrefValidator>>,
): unknown {
  const validate = validators?.[leaf.kind];
  if (validate) {
    try {
      const out = validate(stored, leaf);
      return out === undefined ? leaf.default : out;
    } catch {
      return leaf.default;
    }
  }
  switch (leaf.kind) {
    case 'number':
      return repairNumber(leaf as PrefNumber, stored);
    case 'boolean':
      return (leaf as PrefBoolean).encoding || typeof stored === 'boolean' ? stored : leaf.default;
    case 'string':
    case 'color':
    case 'field':
      return typeof stored === 'string' ? stored : leaf.default;
    case 'enum': {
      const e = leaf as PrefEnum;
      if (e.encoding) return stored;
      return e.options.some((o) => o.value === stored) ? stored : leaf.default;
    }
    default:
      return stored;
  }
}

function repairNumber(leaf: PrefNumber, stored: unknown): unknown {
  if (typeof stored !== 'number' || Number.isNaN(stored)) return leaf.default;
  const { endless } = leaf;
  if (stored === Infinity && (endless === 'max' || endless === 'both')) return stored;
  if (stored === -Infinity && (endless === 'min' || endless === 'both')) return stored;
  let v = stored;
  if (leaf.min !== undefined && v < leaf.min) v = leaf.min;
  if (leaf.max !== undefined && v > leaf.max) v = leaf.max;
  return Number.isFinite(v) ? v : leaf.default;
}
```

Export: `export { repairPrefValue, type PrefValidator } from './repair';`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/repair.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "add read-time repair of stored pref values against the schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs
```

---

### Task 7: The store

**Files:**
- Create: `packages/prefs/src/store.ts`, `packages/prefs/src/store.test.ts`
- Modify: `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/store.test.ts`:

```ts
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from './schema';
import { createPrefsStore, type PrefChange } from './store';

const SCHEMA = {
  name: 'Test',
  children: {
    view: {
      name: 'View',
      children: {
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
      },
    },
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
} satisfies PrefGroup;

const make = (initial: [string, unknown][] = [], backing = new Map<string, unknown>()) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.', initial });
  return { cache, store: createPrefsStore(SCHEMA, cache) };
};

describe('createPrefsStore', () => {
  it('reads the default for a leaf with no record', () => {
    const { store } = make();
    expect(store.get('view.grid')).toBe(true);
    expect(store.isSet('view.grid')).toBe(false);
  });

  it('reads a stored value, repaired', () => {
    const { store } = make([['view.density', 999], ['name', 'doc']]);
    expect(store.get('view.density')).toBe(288);
    expect(store.get('name')).toBe('doc');
  });

  it('sets a leaf, pinning it even at its default', () => {
    const { store } = make();
    store.set('view.grid', true);
    expect(store.isSet('view.grid')).toBe(true);
    expect(store.unset().has('view.grid')).toBe(false);
  });

  it('writes the value it was given, unrepaired, and reads it repaired', async () => {
    const backing = new Map<string, unknown>();
    const { cache, store } = make([], backing);
    store.set('view.density', 999);
    await cache.flush();
    expect(backing.get('p.view.density')).toBe(999);
    expect(store.get('view.density')).toBe(288);
  });

  it('warns and ignores a set on a path the schema lacks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cache, store } = make();
    store.set('view.nope' as never, 1 as never);
    expect(cache.has('view.nope')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resets one leaf, a subtree, or everything', () => {
    const { store } = make([['view.grid', false], ['view.density', 10], ['name', 'x']]);
    store.reset('view.grid');
    expect(store.isSet('view.grid')).toBe(false);
    expect(store.isSet('view.density')).toBe(true);
    store.reset('view');
    expect(store.isSet('view.density')).toBe(false);
    expect(store.isSet('name')).toBe(true);
    store.reset();
    expect(store.isSet('name')).toBe(false);
  });

  it('builds a resolved value tree and keeps its identity until something changes', () => {
    const { store } = make([['name', 'doc']]);
    const first = store.values();
    expect(first).toEqual({ view: { grid: true, density: 72 }, name: 'doc' });
    expect(store.values()).toBe(first);
    expect(store.unset()).toBe(store.unset());
    store.set('name', 'other');
    expect(store.values()).not.toBe(first);
    expect(store.unset()).toEqual(new Set(['view.grid', 'view.density']));
  });

  it('tells subscribers what changed, with the value readers now see', () => {
    const { store } = make();
    const heard: PrefChange[][] = [];
    const stop = store.subscribe((c) => heard.push(c));
    store.set('view.density', 999);
    stop();
    store.set('name', 'ignored');
    expect(heard).toEqual([[{ path: 'view.density', value: 288, origin: 'local' }]]);
  });

  it('hears a remote change through the cache', () => {
    const backing = new Map<string, unknown>();
    const { store } = make([], backing);
    const peer = createMemoryAdapter(backing);
    const heard: PrefChange[][] = [];
    store.subscribe((c) => heard.push(c));
    void peer.set('p.view.grid', false);
    return vi.waitFor(() => {
      expect(heard).toEqual([[{ path: 'view.grid', value: false, origin: 'remote' }]]);
      expect(store.get('view.grid')).toBe(false);
    });
  });

  it('exposes its schema', () => {
    expect(make().store.schema).toBe(SCHEMA);
  });
});
```

Before relying on the remote-change test, read `createMemoryAdapter` in `packages/storage/src/adapters.ts`: two adapters over the same `backing` map hear each other through `subscribe` (that is what the contract suite's `foreign` peer uses). If its notification is synchronous, the `waitFor` still passes.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/store.test.ts`
Expected: FAIL — `./store` does not exist.

- [ ] **Step 3: Implement**

`packages/prefs/src/store.ts`:

```ts
import type { OwnedRecordCache } from '@weasel-js/storage';
import { prefLeaves } from './helpers';
import type { PrefPath, PrefValueAt } from './paths';
import { type PrefValidator, repairPrefValue } from './repair';
import type { PrefGroup } from './schema';

/** One leaf changing, as a store subscriber hears it: the value readers now
 *  see, and whether this store or another writer made the change. */
export interface PrefChange {
  path: string;
  value: unknown;
  origin: 'local' | 'remote';
}

/** Values for one schema, held in memory and persisted behind. */
export interface PrefsStore<S extends PrefGroup> {
  readonly schema: S;
  /** The leaf's value, repaired against the schema; its default when unset. */
  get<P extends PrefPath<S>>(path: P): PrefValueAt<S, P>;
  set<P extends PrefPath<S>>(path: P, value: PrefValueAt<S, P>): void;
  /** Unset the leaf at `path` and every leaf under it; with no path, all. */
  reset(path?: string): void;
  /** Whether the leaf has a value of its own rather than following its default. */
  isSet(path: PrefPath<S>): boolean;
  /** Every leaf's value as a nested tree. The same object until something changes. */
  values(): Record<string, unknown>;
  /** The leaves following their default. The same set until something changes. */
  unset(): ReadonlySet<string>;
  subscribe(listener: (changes: PrefChange[]) => void): () => void;
  /** False when the store cannot persist: storage was unreadable, or written
   *  by a newer schema. Changes still apply for this session. */
  readonly writable: boolean;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/** The record holding the schema version the stored values were written at. */
export const VERSION_RECORD = '$version';

interface Snapshot {
  byPath: Map<string, unknown>;
  tree: Record<string, unknown>;
  unset: ReadonlySet<string>;
}

/** A store over an open cache. `openPrefs` / `openPrefsSync` are the usual
 *  way in; they run migrations first. */
export function createPrefsStore<S extends PrefGroup>(
  schema: S,
  cache: OwnedRecordCache,
  validators?: Readonly<Record<string, PrefValidator>>,
): PrefsStore<S> {
  const leaves = prefLeaves(schema);
  let snapshot: Snapshot | null = null;

  const build = (): Snapshot => {
    const byPath = new Map<string, unknown>();
    const unset = new Set<string>();
    const tree: Record<string, unknown> = {};
    for (const [path, leaf] of leaves) {
      const has = cache.has(path);
      const value = has ? repairPrefValue(leaf, cache.get(path), validators) : leaf.default;
      if (!has) unset.add(path);
      byPath.set(path, value);
      const parts = path.split('.');
      let cursor = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        cursor = (cursor[parts[i]!] ??= {}) as Record<string, unknown>;
      }
      cursor[parts[parts.length - 1]!] = value;
    }
    return { byPath, tree, unset };
  };
  const current = (): Snapshot => (snapshot ??= build());

  const listeners = new Set<(changes: PrefChange[]) => void>();
  cache.subscribe((changes) => {
    const mine = changes.filter((c) => leaves.has(c.name));
    if (mine.length === 0) return;
    snapshot = null;
    const now = current();
    const out = mine.map((c): PrefChange => ({ path: c.name, value: now.byPath.get(c.name), origin: c.origin }));
    for (const listener of [...listeners]) listener(out);
  });

  return {
    schema,
    get: (path) => current().byPath.get(path) as never,
    set: (path, value) => {
      if (!leaves.has(path)) {
        console.warn(`[prefs] no leaf at "${path}"; ignoring the write`);
        return;
      }
      cache.set(path, value);
    },
    reset: (path) => {
      for (const p of leaves.keys()) {
        if (path === undefined || p === path || p.startsWith(`${path}.`)) cache.delete(p);
      }
    },
    isSet: (path) => cache.has(path),
    values: () => current().tree,
    unset: () => current().unset,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get writable() {
      return cache.writable;
    },
    flush: () => cache.flush(),
    close: () => cache.close(),
  };
}
```

Export: `export { createPrefsStore, type PrefChange, type PrefsStore, VERSION_RECORD } from './store';`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/store.test.ts && npm run typecheck`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git commit -m "add the prefs store over a record cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs
```

---

### Task 8: Migrations

**Files:**
- Create: `packages/prefs/src/migrate.ts`, `packages/prefs/src/migrate.test.ts`
- Modify: `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/migrate.test.ts`:

```ts
import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import { type PrefsMigration, runPrefsMigrations } from './migrate';
import { VERSION_RECORD } from './store';

const cacheWith = (initial: [string, unknown][]) =>
  createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial });

const renameGrid: PrefsMigration = (records) => {
  if (records.has('view.gridOn')) {
    records.set('view.grid.visible', records.get('view.gridOn'));
    records.delete('view.gridOn');
  }
};
const doubleDensity: PrefsMigration = (records) => {
  const d = records.get('view.density');
  if (typeof d === 'number') records.set('view.density', d * 2);
};

describe('runPrefsMigrations', () => {
  it('runs every migration from the stored version up, in order, and records the new version', () => {
    const cache = cacheWith([['view.gridOn', false], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.has('view.gridOn')).toBe(false);
    expect(cache.get('view.grid.visible')).toBe(false);
    expect(cache.get('view.density')).toBe(20);
    expect(cache.get(VERSION_RECORD)).toBe(2);
  });

  it('skips migrations already applied', () => {
    const cache = cacheWith([[VERSION_RECORD, 1], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.get('view.density')).toBe(20);
  });

  it('does nothing at the current version', () => {
    const cache = cacheWith([[VERSION_RECORD, 2], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid, doubleDensity]);
    expect(cache.get('view.density')).toBe(10);
  });

  it('records the version on an empty store, so later migrations do not run on fresh data', () => {
    const cache = cacheWith([]);
    runPrefsMigrations(cache, [renameGrid]);
    expect(cache.get(VERSION_RECORD)).toBe(1);
  });

  it('opens read-only on a version newer than it knows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = cacheWith([[VERSION_RECORD, 5], ['view.density', 10]]);
    runPrefsMigrations(cache, [renameGrid]);
    expect(cache.writable).toBe(false);
    expect(cache.get('view.density')).toBe(10);
    expect(warn.mock.calls[0]![0]).toContain('5');
    warn.mockRestore();
  });

  it('writes nothing and opens read-only when a migration throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = cacheWith([['view.gridOn', false]]);
    const boom: PrefsMigration = () => {
      throw new Error('boom');
    };
    runPrefsMigrations(cache, [renameGrid, boom]);
    expect(cache.writable).toBe(false);
    expect(cache.get('view.gridOn')).toBe(false);
    expect(cache.has('view.grid.visible')).toBe(false);
    expect(cache.has(VERSION_RECORD)).toBe(false);
    warn.mockRestore();
  });

  it('leaves a read-only cache alone', () => {
    const cache = createRecordCache({
      storage: createMemoryAdapter(),
      prefix: 'p.',
      initial: [['view.density', 10]],
      writable: false,
    });
    runPrefsMigrations(cache, [doubleDensity]);
    expect(cache.get('view.density')).toBe(10);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/migrate.test.ts`
Expected: FAIL — `./migrate` does not exist.

- [ ] **Step 3: Implement**

`packages/prefs/src/migrate.ts`:

```ts
import type { OwnedRecordCache } from '@weasel-js/storage';
import { VERSION_RECORD } from './store';

/** Takes stored records from one version to the next: rename, transform or
 *  delete entries in `records`, keyed by leaf path. */
export type PrefsMigration = (records: Map<string, unknown>) => void;

/**
 * Bring `cache` up to `migrations.length`, the current version. Every record
 * a migration leaves is written back, so a migration may replace values or
 * mutate them in place. Stops writing, and writes nothing, when the stored
 * version is newer than this build knows or a migration throws.
 */
export function runPrefsMigrations(
  cache: OwnedRecordCache,
  migrations: readonly PrefsMigration[],
): void {
  const target = migrations.length;
  const raw = cache.get(VERSION_RECORD);
  const stored = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
  if (stored > target) {
    console.warn(
      `[prefs] "${cache.prefix}" was written at version ${stored}, newer than this build's ${target}; opening read-only`,
    );
    cache.stopWriting();
    return;
  }
  if (stored === target || !cache.writable) return;

  const before = cache.entries().filter(([name]) => name !== VERSION_RECORD);
  const records = new Map(before.map(([name, value]): [string, unknown] => [name, structuredClone(value)]));
  for (let v = stored; v < target; v++) {
    try {
      migrations[v]!(records);
    } catch (error) {
      console.warn(
        `[prefs] migration ${v} → ${v + 1} for "${cache.prefix}" threw; opening read-only on the unmigrated records`,
        error,
      );
      cache.stopWriting();
      return;
    }
  }
  for (const [name] of before) if (!records.has(name)) cache.delete(name);
  for (const [name, value] of records) cache.set(name, value);
  cache.set(VERSION_RECORD, target);
}
```

`structuredClone` keeps a migration's in-place mutation from touching the cache's values before the run is known to succeed.

Export: `export { type PrefsMigration, runPrefsMigrations } from './migrate';`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "add versioned pref migrations that run once on open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs
```

---

### Task 9: `openPrefs` and `openPrefsSync`

**Files:**
- Create: `packages/prefs/src/open.ts`, `packages/prefs/src/open.test.ts`
- Modify: `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/open.test.ts`:

```ts
import { createMemoryAdapter, urlHashAdapter } from '@weasel-js/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { openPrefs, openPrefsSync } from './open';
import type { PrefGroup } from './schema';
import { VERSION_RECORD } from './store';

const SCHEMA = {
  name: 'Test',
  children: {
    density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
  },
} satisfies PrefGroup;

describe('openPrefs', () => {
  it('loads stored values before resolving', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(store.get('density')).toBe(20);
  });

  it('runs migrations before the first read', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      migrations: [(r) => r.set('density', (r.get('density') as number) * 2)],
    });
    expect(store.get('density')).toBe(40);
    await store.flush();
    expect(backing.get(`p.${VERSION_RECORD}`)).toBe(1);
  });

  it('applies validators', async () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = await openPrefs(SCHEMA, {
      storage: createMemoryAdapter(backing),
      prefix: 'p.',
      validators: { number: () => 7 },
    });
    expect(store.get('density')).toBe(7);
  });
});

describe('openPrefsSync', () => {
  it('returns a ready store from an adapter that lists synchronously', () => {
    const backing = new Map<string, unknown>([['p.density', 20]]);
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(store.get('density')).toBe(20);
  });

  it('refuses, at compile time, an adapter that cannot', () => {
    expectTypeOf(openPrefsSync<typeof SCHEMA>)
      .parameter(1)
      .not.toMatchTypeOf<{ storage: typeof urlHashAdapter; prefix: string }>();
  });
});
```

`createMemoryAdapter()`'s return type must expose `listSync` as present for the first `openPrefsSync` test to typecheck. If Task 2 left it typed as plain `StorageAdapter`, change its return type to `SyncStorageAdapter` now, and do the same for `localStorageAdapter` and `sessionStorageAdapter` (`webStorageAdapter` returns `SyncStorageAdapter`). That is the point of the type: a caller holding `localStorageAdapter` can pass it straight to `openPrefsSync`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/open.test.ts`
Expected: FAIL — `./open` does not exist.

- [ ] **Step 3: Implement**

`packages/prefs/src/open.ts`:

```ts
import {
  openRecords,
  openRecordsSync,
  type StorageAdapter,
  type SyncStorageAdapter,
} from '@weasel-js/storage';
import { type PrefsMigration, runPrefsMigrations } from './migrate';
import type { PrefValidator } from './repair';
import type { PrefGroup } from './schema';
import { createPrefsStore, type PrefsStore } from './store';

/** Options for `openPrefs` and `openPrefsSync`. */
export interface PrefsOptions {
  storage: StorageAdapter;
  /** Prepended to every record's key: `'myapp.prefs.'`. */
  prefix: string;
  /** `migrations[i]` takes stored records from version `i` to `i + 1`. The
   *  current version is `migrations.length`. */
  migrations?: readonly PrefsMigration[];
  /** Validators for app-defined kinds, keyed by `kind`. One given for a
   *  built-in kind replaces that kind's own rule. */
  validators?: Readonly<Record<string, PrefValidator>>;
}

/** Load every stored value for `schema`, migrate it, and return the store. */
export async function openPrefs<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions,
): Promise<PrefsStore<S>> {
  const cache = await openRecords({ storage: options.storage, prefix: options.prefix });
  runPrefsMigrations(cache, options.migrations ?? []);
  return createPrefsStore(schema, cache, options.validators);
}

/** `openPrefs` for an adapter that reads synchronously: the store is ready
 *  on return, so values can be read before anything renders. */
export function openPrefsSync<S extends PrefGroup>(
  schema: S,
  options: PrefsOptions & { storage: SyncStorageAdapter },
): PrefsStore<S> {
  const cache = openRecordsSync({ storage: options.storage, prefix: options.prefix });
  runPrefsMigrations(cache, options.migrations ?? []);
  return createPrefsStore(schema, cache, options.validators);
}
```

Export: `export { openPrefs, openPrefsSync, type PrefsOptions } from './open';`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs packages/storage && npm run typecheck`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git commit -m "add openPrefs and openPrefsSync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs packages/storage
```

---

### Task 10: Hooks

**Files:**
- Create: `packages/prefs/src/hooks.ts`, `packages/prefs/src/hooks.test.tsx`
- Modify: `packages/prefs/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/prefs/src/hooks.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { usePref, usePrefsValues } from './hooks';
import { openPrefsSync } from './open';
import type { PrefGroup } from './schema';

const SCHEMA = {
  name: 'Test',
  children: {
    grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
    density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
  },
} satisfies PrefGroup;

const open = () => openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'p.' });

describe('usePref', () => {
  it('reads the leaf and re-renders when it changes', () => {
    const store = open();
    const { result } = renderHook(() => usePref(store, 'density'));
    expect(result.current[0]).toBe(72);
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(100);
    expect(store.get('density')).toBe(100);
  });

  it('takes a functional update', () => {
    const store = open();
    const { result } = renderHook(() => usePref(store, 'density'));
    act(() => result.current[1]((d) => d + 1));
    expect(result.current[0]).toBe(73);
  });

  it('hears a write made through another binding', () => {
    const store = open();
    const a = renderHook(() => usePref(store, 'grid'));
    const b = renderHook(() => usePref(store, 'grid'));
    act(() => a.result.current[1](false));
    expect(b.result.current[0]).toBe(false);
  });
});

describe('usePrefsValues', () => {
  it('returns the tree, the unset paths, a setter and a reset, for PrefsForm', () => {
    const store = open();
    const { result } = renderHook(() => usePrefsValues(store));
    expect(result.current.values).toEqual({ grid: true, density: 72 });
    expect(result.current.unset).toEqual(new Set(['grid', 'density']));
    act(() => result.current.set('grid', false));
    expect(result.current.values).toEqual({ grid: false, density: 72 });
    expect(result.current.unset).toEqual(new Set(['density']));
    act(() => result.current.reset('grid'));
    expect(result.current.values.grid).toBe(true);
  });

  it('hears a leaf binding', () => {
    const store = open();
    const tree = renderHook(() => usePrefsValues(store));
    const leaf = renderHook(() => usePref(store, 'density'));
    act(() => leaf.result.current[1](10));
    expect(tree.result.current.values.density).toBe(10);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=weasel-ui packages/prefs/src/hooks.test.tsx`
Expected: FAIL — `./hooks` does not exist.

- [ ] **Step 3: Implement**

`packages/prefs/src/hooks.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react';
import type { PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './schema';
import type { PrefsStore } from './store';

/** One leaf of `store`, as React state. */
export function usePref<S extends PrefGroup, P extends PrefPath<S>>(
  store: PrefsStore<S>,
  path: P,
): [
  PrefValueAt<S, P>,
  (next: PrefValueAt<S, P> | ((prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)) => void,
] {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const value = useSyncExternalStore(subscribe, () => store.get(path));
  const set = useCallback(
    (next: PrefValueAt<S, P> | ((prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)) => {
      store.set(
        path,
        typeof next === 'function'
          ? (next as (prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)(store.get(path))
          : next,
      );
    },
    [store, path],
  );
  return [value, set];
}

/** The whole of `store` as React state, shaped for `PrefsForm`: `values`,
 *  `onChange={set}`, `auto={unset}`, and `reset` for `onAutoChange`. */
export function usePrefsValues<S extends PrefGroup>(store: PrefsStore<S>): {
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  unset: ReadonlySet<string>;
  reset: (path?: string) => void;
} {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const values = useSyncExternalStore(subscribe, store.values);
  const unset = useSyncExternalStore(subscribe, store.unset);
  const set = useCallback(
    (path: string, value: unknown) => store.set(path as PrefPath<S>, value as never),
    [store],
  );
  const reset = useCallback((path?: string) => store.reset(path), [store]);
  return { values, set, unset, reset };
}
```

`store.values` and `store.unset` are passed unbound to `useSyncExternalStore`; that works because `createPrefsStore` builds them as closures, not methods using `this`. Don't change that.

Export: `export { usePref, usePrefsValues } from './hooks';`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=weasel-ui packages/prefs --reporter=default`
Expected: PASS, and no "not wrapped in act(...)" warnings in the output.

- [ ] **Step 5: Commit**

```bash
git commit -m "add usePref and usePrefsValues hooks over a prefs store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/prefs
```

---

### Task 11: Move draw onto the store

**Files:**
- Modify: `apps/draw/src/prefs.ts`, `apps/draw/src/prefs.test.ts`, `apps/draw/src/panels.ts`, `apps/draw/src/panels.test.ts`, `apps/draw/src/main.tsx`, `apps/draw/src/App.tsx`, `apps/draw/src/PreferencesModal.tsx`, `apps/draw/src/dev/PrefSchemaPage.tsx`

- [ ] **Step 1: Rewrite the draw tests against the new API**

Replace `apps/draw/src/prefs.test.ts` with tests of draw's own wiring only (the store's behavior is covered in `packages/prefs`). Keep the file's existing `beforeAll` localStorage shim at the top unchanged, then:

```ts
import { renderHook, act } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import type { PrefGroup } from '@weasel-js/prefs';
import {
  LEGACY_PREFS_KEY,
  PREFS,
  PREFS_PREFIX,
  importLegacyPrefs,
  openDrawPrefs,
  usePref,
} from './prefs';

describe('PREFS', () => {
  it('assigns to PrefGroup without a cast', () => {
    const g: PrefGroup = PREFS;
    expect(g.children.view).toBeDefined();
  });
});

describe('openDrawPrefs', () => {
  it('reads a stored leaf by its path', () => {
    const backing = new Map<string, unknown>([[`${PREFS_PREFIX}view.gridDensity`, 40]]);
    const store = openDrawPrefs(createMemoryAdapter(backing));
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(true);
  });

  it('round-trips a tool-contributed pref at its composed path', async () => {
    const backing = new Map<string, unknown>();
    const store = openDrawPrefs(createMemoryAdapter(backing));
    store.set('tools.pen.autoCommitOnClose', false);
    await store.flush();
    expect(backing.get(`${PREFS_PREFIX}tools.pen.autoCommitOnClose`)).toBe(false);
  });
});

describe('importLegacyPrefs', () => {
  beforeEach(() => window.localStorage.clear());

  it('copies every leaf of the v2 blob into the store, then removes the blob', () => {
    window.localStorage.setItem(
      LEGACY_PREFS_KEY,
      JSON.stringify({ version: 2, view: { gridDensity: 40, gridVisible: false }, stray: 1 }),
    );
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(40);
    expect(store.get('view.gridVisible')).toBe(false);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull();
  });

  it('does not overwrite a leaf the store already holds', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify({ version: 2, view: { gridDensity: 40 } }));
    const store = openDrawPrefs(createMemoryAdapter(new Map([[`${PREFS_PREFIX}view.gridDensity`, 8]])));
    importLegacyPrefs(store, window.localStorage);
    expect(store.get('view.gridDensity')).toBe(8);
  });

  it('drops a blob it cannot parse', () => {
    window.localStorage.setItem(LEGACY_PREFS_KEY, '{not json');
    const store = openDrawPrefs(createMemoryAdapter());
    importLegacyPrefs(store, window.localStorage);
    expect(window.localStorage.getItem(LEGACY_PREFS_KEY)).toBeNull();
    expect(store.unset().size).toBeGreaterThan(0);
  });
});

describe('usePref', () => {
  it('binds a leaf of the app store', () => {
    const { result } = renderHook(() => usePref('view.snapToGrid'));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
```

In `panels.test.ts`, replace each `JSON.parse(window.localStorage.getItem(PREFS_KEY)!).ui.panels` with `drawPrefs().get('ui.panels')`, each seeding of `PREFS_KEY` with `drawPrefs().set('ui.panels', …)`, and the "no-op without legacy keys" assertion with `expect(drawPrefs().isSet('ui.panels')).toBe(false)`. Add a `beforeEach(() => drawPrefs().reset())`. Import `drawPrefs` from `./prefs`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=draw apps/draw/src/prefs.test.ts apps/draw/src/panels.test.ts`
Expected: FAIL — `openDrawPrefs`, `importLegacyPrefs`, `drawPrefs`, `PREFS_PREFIX`, `LEGACY_PREFS_KEY` are not exported.

- [ ] **Step 3: Rewrite `apps/draw/src/prefs.ts`**

Keep the header comment (reworded below), the custom-kind types (`WeaselDrawPrefRegistryEnum`, `WeaselDrawPrefData`), `composeToolPrefs`, `PANELS_PREF`, `LAST_TOOL` and `PREFS`. Delete everything from the "Type-level path inference" banner to the end of the file, and the type aliases that only restated core's (`WeaselDrawPrefNumber`, `WeaselDrawPrefBoolean`, `WeaselDrawPrefString`, `WeaselDrawPrefEnum`, `WeaselDrawPref`, `WeaselDrawPrefGroup`, `WeaselDrawPrefKind`): replace their uses with the `@weasel-js/prefs` names directly.

Widen `LAST_TOOL`'s default so the leaf holds any tool id rather than the literal `'select'`:

```ts
const LAST_TOOL = {
  kind: 'registry-enum',
  source: 'tools',
  name: 'Last used tool',
  description: 'Restored on app start.',
  default: 'select' as string,
} as const satisfies WeaselDrawPrefRegistryEnum;
```

Then append:

```ts
// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

/** Every pref is one localStorage record under this prefix. */
export const PREFS_PREFIX = 'weaseldraw.prefs.';

/** Where prefs lived before the store: one JSON blob of the whole tree. */
export const LEGACY_PREFS_KEY = 'weaseldraw.prefs.v2';

export type DrawPrefPath = PrefPath<typeof PREFS>;
export type DrawPrefValue<P extends DrawPrefPath> = PrefValueAt<typeof PREFS, P>;

/** The app's prefs over `storage`. Tests pass a memory adapter. */
export function openDrawPrefs(storage: SyncStorageAdapter): PrefsStore<typeof PREFS> {
  return openPrefsSync(PREFS, { storage, prefix: PREFS_PREFIX });
}

let store: PrefsStore<typeof PREFS> | null = null;

/** The app's prefs, opened on first use so a test's storage shim is in place
 *  before anything reads `localStorage`. */
export function drawPrefs(): PrefsStore<typeof PREFS> {
  return (store ??= openDrawPrefs(localStorageAdapter));
}

/** Fold the pre-store blob into the store once, then delete it. A leaf the
 *  store already holds wins. */
export function importLegacyPrefs(
  target: PrefsStore<typeof PREFS>,
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  let raw: string | null;
  try {
    raw = storage.getItem(LEGACY_PREFS_KEY);
  } catch {
    return;
  }
  if (raw === null) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    for (const [path, value] of flattenPrefValues(PREFS, parsed)) {
      if (!target.isSet(path as DrawPrefPath)) target.set(path as DrawPrefPath, value as never);
    }
  } catch {
    /* unparseable — nothing to keep */
  }
  storage.removeItem(LEGACY_PREFS_KEY);
}

/** One leaf of the app's prefs, as React state. */
export function usePref<P extends DrawPrefPath>(path: P) {
  return usePrefOf(drawPrefs(), path);
}
```

Imports at the top of the file:

```ts
import {
  flattenPrefValues,
  openPrefsSync,
  usePref as usePrefOf,
  type PrefBase,
  type PrefEnumControl,
  type PrefGroup,
  type PrefPath,
  type PrefsStore,
  type PrefValueAt,
} from '@weasel-js/prefs';
import { localStorageAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
```

(plus whichever `@weasel-js/prefs` types the kept declarations still name). Rewrite the header comment:

```ts
// WeaselDraw's per-user preferences: the schema, and the store over
// localStorage that holds them, one record per leaf.
```

- [ ] **Step 4: Move the call sites**

- `apps/draw/src/panels.ts`: `readPref('ui.panels')` → `drawPrefs().get('ui.panels')`; `writePref('ui.panels', panels)` → `drawPrefs().set('ui.panels', panels)`; import `drawPrefs, usePref` from `./prefs`.
- `apps/draw/src/main.tsx`: immediately before `migrateLegacyPanelFlags();` (line 71 as of 2026-10-09), add `importLegacyPrefs(drawPrefs());` and import both from `./prefs`. Order matters: the legacy blob must land before the panel flags fold into `ui.panels`.
- `apps/draw/src/App.tsx`: `usePref` calls are unchanged.
- `apps/draw/src/PreferencesModal.tsx`:

```tsx
  const { values, set, unset, reset } = usePrefsValues(drawPrefs());
```

and on `<PrefsDialog>`: `values={values}`, `onChange={set}`, `auto={unset}`, `onAutoChange={(path, next) => (next ? reset(path) : set(path, drawPrefs().get(path as DrawPrefPath)))}`. Import `usePrefsValues` from `@weasel-js/prefs` and `drawPrefs`, `DrawPrefPath` from `./prefs`.
- `apps/draw/src/dev/PrefSchemaPage.tsx`: `const [stored] = usePrefsValues();` → `const { values: stored } = usePrefsValues(drawPrefs());`, same imports.

- [ ] **Step 5: Run the draw tests and typecheck**

Run: `npx vitest run --project=draw apps/draw/src && npm run typecheck`
Expected: PASS, exit 0.

- [ ] **Step 6: See it in the browser**

Start draw's dev server in the background from the worktree (`npm run dev:draw` — check `package.json` for the exact script name; start any second copy with `WAKE_EXTRA=<port>`). In headless Playwright: open the app, open Preferences, toggle "Show grid" off, reload, and confirm it is still off; then confirm `localStorage` holds `weaseldraw.prefs.view.gridVisible` = `false` and no `weaseldraw.prefs.v2`. Do a hard reload, not an HMR save — `useScene` keeps stale state across HMR. Stop the server afterward.

- [ ] **Step 7: Commit**

```bash
git commit -m "move draw's prefs onto the prefs store, importing the old v2 blob once

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/draw/src
```

---

### Task 12: Repo checks, changesets, TODO, and the path-rule follow-up

**Files:**
- Create: `.changeset/prefs-store.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Run the repo checks**

```bash
npm run check:test-projects
npm run check:manifests
npm run build
npm run test:smoke:consumer
```

Expected: all exit 0. `check:test-projects` must show `packages/storage` and `packages/prefs` collected by `weasel-ui`. `check:manifests` failing names an undeclared dependency — add it to that package's `package.json`. `npm run build` takes several minutes of CPU; it is part of the normal toolchain but ask before running it if the machine is busy.

- [ ] **Step 2: Write the changeset**

`.changeset/prefs-store.md`:

```markdown
---
"@weasel-js/storage": patch
"@weasel-js/prefs": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

New `@weasel-js/storage` package: the storage adapters and `RecordCache` that
lived in labkit, plus synchronous listing for localStorage, sessionStorage and
memory (`listSync`, `openRecordsSync`). labkit re-exports the adapters and keeps
its IndexedDB data where it was.

New `@weasel-js/prefs` package: the preferences schema, moved out of core, and a
store for it — `openPrefs` / `openPrefsSync`, one record per leaf, values
repaired against the schema on read, versioned migrations, and the `usePref` /
`usePrefsValues` hooks, whose output `PrefsForm` takes directly.

Breaking: the schema types are renamed from `ToolPref*` to `Pref*` (`ToolPref`
itself is `BuiltinPref`, `TOOL_PREF_KINDS` is `PREF_KINDS`, `isBuiltinToolPref`
is `isBuiltinPref`) and are imported from `@weasel-js/prefs`. Neither core nor
ui re-exports them, nor ui's `isPrefLeaf`, `prefValueAtPath`,
`visiblePrefSubtree`, `filterPrefSubtree` or `prefDisplayBounds`. The IndexedDB
adapter's cross-tab channel is renamed, so tabs on an older and a newer labkit
stop hearing each other until both reload.
```

Run: `npm run check:bumps`
Expected: exit 0.

- [ ] **Step 3: File the path-rule inconsistency**

Add to `docs/TODO.md`, in the section where schema/UI entries live (search for `PrefsForm` or `SelectionPanel`):

```markdown
- [ ] **One path rule for pref schemas** (P2). `PrefsForm`, the prefs store and
  labkit's config resolver treat a group's key as a path segment
  (`view.gridDensity`); `SelectionPanel`'s model treats it as a heading only, and
  `PrefObject`'s doc comment states that rule as general. Same schema type, two
  answers to "what is this leaf's path". Decide which is right for which surface
  and make the type say so.
```

- [ ] **Step 4: Commit**

```bash
git commit -m "add the storage and prefs changeset, and file the pref path-rule inconsistency

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- .changeset/prefs-store.md docs/TODO.md
```

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch. On merge: delete `docs/superpowers/plans/2026-10-09-prefs-store.md` and `docs/superpowers/specs/2026-10-09-prefs-store-design.md` in the merge (git log is the archive), start `onto test` in the background, remove the worktree, and delete the branch.
