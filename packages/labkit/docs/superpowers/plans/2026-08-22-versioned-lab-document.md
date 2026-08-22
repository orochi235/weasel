# Versioned Lab Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace labkit's four unversioned `localStorage` buckets with one versioned document carrying a migration chain, so changing the persisted shape stops silently destroying saved labs.

**Architecture:** A new `src/state/document.ts` owns the document type, the version constant, the migration chain, and the legacy read. `createLabStore` hydrates by reading one key, running the chain, and falling back to a legacy read when that key is absent; it flushes the whole document to that one key. A document from a future version disables persistence rather than overwriting it. A migration that throws quarantines the raw text under a second key.

**Tech Stack:** TypeScript, zustand vanilla store, vitest. Package is `@weasel-js/labkit` at `packages/labkit/`. All commands below run from `packages/labkit/`.

**Spec:** `docs/superpowers/specs/2026-08-22-versioned-lab-document-design.md`

**Vocabulary note:** this plan uses today's names (`workspaces`, `WorkspaceRecord`). The vocabulary refresh renames them afterward as document migration 1 → 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/state/document.ts` *(create)* | Document type, `CURRENT_DOCUMENT_VERSION`, key helpers, `MIGRATIONS`, `runMigrations`, `readLegacyDocument` |
| `src/state/document.test.ts` *(create)* | Unit tests for everything in `document.ts` |
| `src/state/types.ts` *(modify)* | `LabDocument`, `SerializedTrial`, `Migration` |
| `src/state/helpers.ts` *(modify)* | `serializeWorkspaces` / `deserializeWorkspaces` move from strings to records |
| `src/state/helpers.test.ts` *(modify)* | Follow the signature change |
| `src/state/store.ts` *(modify)* | Hydrate from the document; flush to the document; `persistDisabled` |
| `src/state/store.test.ts` *(modify)* | Legacy-fold, future-version and quarantine coverage |
| `src/state/index.ts` *(modify)* | Export the document surface |

`labStorageKey` stays in `helpers.ts` — migration 0 → 1 and the tests still need the legacy bucket names.

---

### Task 1: Document types and keys

**Files:**
- Create: `src/state/document.ts`
- Modify: `src/state/types.ts`
- Test: `src/state/document.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/document.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_VERSION,
  emptyDocument,
  labDocumentKey,
  quarantineKey,
} from './document';

describe('document keys', () => {
  it('namespaces the document key by storageKey', () => {
    expect(labDocumentKey('mylab')).toBe('lk:mylab');
  });

  it('namespaces the quarantine key by storageKey', () => {
    expect(quarantineKey('mylab')).toBe('lk:mylab:quarantine');
  });
});

describe('emptyDocument', () => {
  it('is stamped at the current version with the given mode', () => {
    const doc = emptyDocument('light');
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
    expect(doc.workspaces).toEqual([]);
    expect(doc.saves).toEqual([]);
    expect(doc.layout).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/document.test.ts`
Expected: FAIL — `Failed to resolve import "./document"`.

- [ ] **Step 3: Add the types**

Append to `src/state/types.ts`:

```ts
/** A workspace as it is persisted: everything but the undo history, which is
 *  session-only. */
export type SerializedTrial = Omit<WorkspaceRecord, 'undoStack'>;

/** Everything a lab persists, under one key, at a known version. */
export interface LabDocument {
  version: number;
  workspaces: SerializedTrial[];
  saves: SavedSnapshot[];
  layout: Record<string, unknown>;
  mode: LabMode;
}

/** Migrates a document one version forward. Index `i` in the chain takes a
 *  version-`i` document to version `i + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
```

- [ ] **Step 4: Write minimal implementation**

Create `src/state/document.ts`:

```ts
import type { LabDocument, LabMode } from './types';

/** Bumped whenever the persisted shape changes; every bump needs a migration. */
export const CURRENT_DOCUMENT_VERSION = 1;

/** The one key a lab persists under. */
export function labDocumentKey(storageKey: string): string {
  return `lk:${storageKey}`;
}

/** Where a document that failed to migrate is set aside, so a bad migration
 *  loses state loudly rather than silently. */
export function quarantineKey(storageKey: string): string {
  return `lk:${storageKey}:quarantine`;
}

/** A fresh document at the current version. */
export function emptyDocument(mode: LabMode): LabDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    workspaces: [],
    saves: [],
    layout: {},
    mode,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/state/document.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/state/document.ts src/state/document.test.ts src/state/types.ts
git commit -m "add the lab document type, its version and its keys"
```

---

### Task 2: `runMigrations`

**Files:**
- Modify: `src/state/document.ts`
- Test: `src/state/document.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/state/document.test.ts`:

```ts
import { runMigrations } from './document';

const bump = (to: number) => (doc: Record<string, unknown>) => ({ ...doc, version: to });

describe('runMigrations', () => {
  it('returns a current-version document untouched', () => {
    const doc = { version: 2, a: 1 };
    const out = runMigrations(doc, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2, a: 1 }, migrated: false });
  });

  it('runs every migration from the stored version to the current one', () => {
    const out = runMigrations({ version: 0 }, [bump(1), bump(2)], 2);
    expect(out).toEqual({ ok: true, doc: { version: 2 }, migrated: true });
  });

  it('refuses a document from a future version', () => {
    const out = runMigrations({ version: 9 }, [bump(1)], 1);
    expect(out).toEqual({ ok: false, reason: 'future' });
  });

  it('reports a throwing migration as failed', () => {
    const boom = () => {
      throw new Error('nope');
    };
    const out = runMigrations({ version: 0 }, [boom], 1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('failed');
  });

  it('treats a document with no version as version 0', () => {
    const out = runMigrations({}, [bump(1)], 1);
    expect(out).toEqual({ ok: true, doc: { version: 1 }, migrated: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/document.test.ts`
Expected: FAIL — `runMigrations is not a function`.

- [ ] **Step 3: Write minimal implementation**

Extend the existing type import at the top of `src/state/document.ts` — do
not add a second `import type ... from './types'` line, biome's import
sorting rejects it:

```ts
import type { LabDocument, LabMode, Migration } from './types';
```

Then append:

```ts
/** What a migration run produced: the migrated document, or why it refused. */
export type MigrationOutcome =
  | { ok: true; doc: Record<string, unknown>; migrated: boolean }
  | { ok: false; reason: 'future' | 'failed'; error?: unknown };

/** Walk a document forward to `target`, one migration at a time. A version
 *  above `target` is refused rather than parsed under a shape it may not
 *  have. */
export function runMigrations(
  raw: Record<string, unknown>,
  migrations: Migration[],
  target: number,
): MigrationOutcome {
  const from = typeof raw.version === 'number' ? raw.version : 0;
  if (from > target) return { ok: false, reason: 'future' };
  if (from === target) return { ok: true, doc: raw, migrated: false };

  let doc = raw;
  try {
    for (let v = from; v < target; v++) {
      const migration = migrations[v];
      if (!migration) throw new Error(`[labkit] no migration from version ${v}`);
      doc = migration(doc);
    }
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
  return { ok: true, doc, migrated: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/document.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/document.ts src/state/document.test.ts
git commit -m "walk a stored document forward through a migration chain"
```

---

### Task 3: Helpers move from strings to records

`serializeWorkspaces` currently returns a JSON string and `deserializeWorkspaces` takes one. The document is stringified once, by the store, so both move to records.

**Files:**
- Modify: `src/state/helpers.ts:33-73`
- Test: `src/state/helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the `serializeWorkspaces` / `deserializeWorkspaces` describes in `src/state/helpers.test.ts` with:

```ts
describe('serializeWorkspaces', () => {
  it('returns records with the undo stack dropped', () => {
    const records = serializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: { a: 1 },
          state: { b: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          undoStack: { past: [{ b: 1 }], future: [] },
        },
      ],
      {},
    );
    expect(records).toEqual([
      {
        id: 'w1',
        instrumentName: 'Test',
        config: { a: 1 },
        state: { b: 2 },
        view: { zoom: 1, pan: { x: 0, y: 0 } },
      },
    ]);
  });

  it('runs the instrument serializer over the state', () => {
    const records = serializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { n: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          undoStack: { past: [], future: [] },
        },
      ],
      { Test: { serialize: (s) => ({ doubled: (s as { n: number }).n * 2 }) } },
    );
    expect(records[0].state).toEqual({ doubled: 4 });
  });
});

describe('deserializeWorkspaces', () => {
  it('rebuilds records with an empty undo stack', () => {
    const out = deserializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { n: 1 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ],
      {},
    );
    expect(out[0].undoStack).toEqual({ past: [], future: [] });
  });

  it('runs the instrument deserializer over the state', () => {
    const out = deserializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { doubled: 4 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ],
      { Test: { deserialize: (d) => ({ n: (d as { doubled: number }).doubled / 2 }) } },
    );
    expect(out[0].state).toEqual({ n: 2 });
  });

  it('returns an empty list when given something that is not an array', () => {
    expect(deserializeWorkspaces(undefined as never, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/helpers.test.ts`
Expected: FAIL — `serializeWorkspaces` returns a string, so `toEqual` against an array fails.

- [ ] **Step 3: Write minimal implementation**

Replace both functions in `src/state/helpers.ts`:

```ts
/** Serialize workspaces for storage, running each instrument's own serializer
 *  over its state. Undo history is deliberately dropped — it does not survive
 *  a reload. */
export function serializeWorkspaces(
  workspaces: WorkspaceRecord[],
  serializers: InstrumentSerializers,
): SerializedTrial[] {
  return workspaces.map(({ undoStack: _undo, ...w }) => {
    const s = serializers[w.instrumentName];
    return { ...w, state: s?.serialize ? s.serialize(w.state) : w.state };
  });
}

/** Rebuild workspaces from storage, running each instrument's deserializer
 *  over its state and starting each with an empty undo history. Returns an
 *  empty list rather than throwing on malformed input. */
export function deserializeWorkspaces(
  records: SerializedTrial[],
  deserializers: InstrumentSerializers,
): WorkspaceRecord[] {
  if (!Array.isArray(records)) {
    console.warn('[labkit] deserializeWorkspaces: not an array, returning empty list');
    return [];
  }
  return records.map((r) => {
    const d = deserializers[r.instrumentName];
    return {
      ...r,
      state: d?.deserialize ? d.deserialize(r.state) : r.state,
      undoStack: emptyUndoStack(),
    };
  });
}
```

Update the import at the top of `src/state/helpers.ts` to include
`SerializedTrial`, and delete the now-unused local `type SerializedRecord`
alias:

```ts
import type {
  InstrumentSerializers,
  SerializedTrial,
  UndoStack,
  WorkspaceRecord,
} from './types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/helpers.test.ts`
Expected: PASS. `npx vitest run` still fails in `store.test.ts` — Task 5 fixes that.

- [ ] **Step 5: Commit**

```bash
git add src/state/helpers.ts src/state/helpers.test.ts
git commit -m "serialize workspaces to records rather than a string"
```

---

### Task 4: Migration 0 → 1, folding the legacy keys

Version 0 is "no document, four separate keys." The legacy read assembles them into a version-0 object; the migration normalizes it.

This is where the `'interstellar'` → `'dark'` coercion in `store.ts:80` moves. It is an unversioned back-compat branch today — exactly what the chain exists to hold.

**Files:**
- Modify: `src/state/document.ts`
- Test: `src/state/document.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/state/document.test.ts`:

```ts
import { createMemoryAdapter } from './adapters';
import { MIGRATIONS, migrateV0toV1, readLegacyDocument } from './document';
import { labStorageKey } from './helpers';

describe('readLegacyDocument', () => {
  it('returns null when no legacy key is present', () => {
    expect(readLegacyDocument(createMemoryAdapter(), 'lab')).toBeNull();
  });

  it('assembles a version-0 document from the four buckets', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), JSON.stringify([{ id: 'w1' }]));
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));
    storage.write(labStorageKey('lab', 'layout'), JSON.stringify({ w1: { h: 4 } }));
    storage.write(labStorageKey('lab', 'theme'), 'dark');

    expect(readLegacyDocument(storage, 'lab')).toEqual({
      version: 0,
      workspaces: [{ id: 'w1' }],
      saves: [{ id: 's1' }],
      layout: { w1: { h: 4 } },
      mode: 'dark',
    });
  });

  it('survives one unparseable bucket without losing the others', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('lab', 'workspaces'), '{{{not json');
    storage.write(labStorageKey('lab', 'saves'), JSON.stringify([{ id: 's1' }]));

    const doc = readLegacyDocument(storage, 'lab');
    expect(doc?.workspaces).toEqual([]);
    expect(doc?.saves).toEqual([{ id: 's1' }]);
  });
});

describe('migrateV0toV1', () => {
  it('stamps version 1', () => {
    expect(migrateV0toV1({ version: 0 }).version).toBe(1);
  });

  it('renames the old interstellar mode to dark', () => {
    expect(migrateV0toV1({ version: 0, mode: 'interstellar' }).mode).toBe('dark');
  });

  it('replaces an unrecognized mode with auto', () => {
    expect(migrateV0toV1({ version: 0, mode: 'chartreuse' }).mode).toBe('auto');
  });

  it('fills in every missing section', () => {
    expect(migrateV0toV1({ version: 0 })).toEqual({
      version: 1,
      workspaces: [],
      saves: [],
      layout: {},
      mode: 'auto',
    });
  });
});

describe('MIGRATIONS', () => {
  it('has one entry per version below the current one', () => {
    expect(MIGRATIONS).toHaveLength(CURRENT_DOCUMENT_VERSION);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/document.test.ts`
Expected: FAIL — `readLegacyDocument is not a function`.

- [ ] **Step 3: Write minimal implementation**

Extend the imports at the top of `src/state/document.ts` — again, one line
per module:

```ts
import { labStorageKey } from './helpers';
import type { LabDocument, LabMode, Migration, StorageAdapter } from './types';
```

Then append:

```ts
const LEGACY_BUCKETS = ['workspaces', 'saves', 'layout', 'theme'] as const;

function parseOr<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn('[labkit] unparseable legacy bucket, dropping it');
    return fallback;
  }
}

/** Assemble a version-0 document out of the four pre-document keys, or null
 *  if none of them is present. */
export function readLegacyDocument(
  storage: StorageAdapter,
  storageKey: string,
): Record<string, unknown> | null {
  const present = LEGACY_BUCKETS.some(
    (b) => storage.read(labStorageKey(storageKey, b)) !== null,
  );
  if (!present) return null;

  return {
    version: 0,
    workspaces: parseOr(storage.read(labStorageKey(storageKey, 'workspaces')), []),
    saves: parseOr(storage.read(labStorageKey(storageKey, 'saves')), []),
    layout: parseOr(storage.read(labStorageKey(storageKey, 'layout')), {}),
    // `theme` held a bare string, never JSON.
    mode: storage.read(labStorageKey(storageKey, 'theme')) ?? 'auto',
  };
}

/** Delete the four pre-document keys. Called once the migrated document has
 *  been written, never before. */
export function deleteLegacyKeys(storage: StorageAdapter, storageKey: string): void {
  for (const bucket of LEGACY_BUCKETS) {
    storage.delete?.(labStorageKey(storageKey, bucket));
  }
}

/** Version 0 (four loose keys) to version 1 (one document). Normalizes the
 *  mode, including `interstellar` — the dark mode's name back when it was a
 *  theme. */
export function migrateV0toV1(doc: Record<string, unknown>): Record<string, unknown> {
  const raw = doc.mode === 'interstellar' ? 'dark' : doc.mode;
  const mode = raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
  return {
    version: 1,
    workspaces: Array.isArray(doc.workspaces) ? doc.workspaces : [],
    saves: Array.isArray(doc.saves) ? doc.saves : [],
    layout: doc.layout && typeof doc.layout === 'object' ? doc.layout : {},
    mode,
  };
}

/** Index `i` migrates a version-`i` document to version `i + 1`. */
export const MIGRATIONS: Migration[] = [migrateV0toV1];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/document.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/document.ts src/state/document.test.ts
git commit -m "fold the four legacy storage buckets into a version-1 document"
```

---

### Task 5: Hydrate the store from the document

**Files:**
- Modify: `src/state/store.ts:47-92` (the four reads and the `createStore` seed)
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/state/store.test.ts`:

```ts
import { CURRENT_DOCUMENT_VERSION, labDocumentKey, quarantineKey } from './document';

describe('createLabStore — hydrating', () => {
  it('reads a current-version document', () => {
    const storage = createMemoryAdapter();
    storage.write(
      labDocumentKey('test'),
      JSON.stringify({
        version: CURRENT_DOCUMENT_VERSION,
        workspaces: [
          {
            id: 'w1',
            instrumentName: 'Test',
            config: {},
            state: {},
            view: { zoom: 2, pan: { x: 0, y: 0 } },
          },
        ],
        saves: [],
        layout: { w1: { h: 3 } },
        mode: 'dark',
      }),
    );

    const s = makeStore({ storage }).getState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0].undoStack).toEqual({ past: [], future: [] });
    expect(s.layout).toEqual({ w1: { h: 3 } });
    expect(s.mode).toBe('dark');
  });

  it('folds the four legacy keys into state', () => {
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    const s = makeStore({ storage }).getState();
    expect(s.mode).toBe('dark');
  });

  it('starts empty and preserves a document from a future version', () => {
    const storage = createMemoryAdapter();
    const future = JSON.stringify({ version: 999, workspaces: [{ id: 'w1' }] });
    storage.write(labDocumentKey('test'), future);

    const store = makeStore({ storage });
    expect(store.getState().workspaces).toEqual([]);
    expect(storage.read(labDocumentKey('test'))).toBe(future);
  });

  it('quarantines a document that fails to parse', () => {
    const storage = createMemoryAdapter();
    storage.write(labDocumentKey('test'), '{{{not json');

    const s = makeStore({ storage }).getState();
    expect(s.workspaces).toEqual([]);
    expect(storage.read(quarantineKey('test'))).toBe('{{{not json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — the store still reads `lk:test:workspaces`, so the document tests see empty state and the legacy keys are never deleted.

- [ ] **Step 3: Write minimal implementation**

In `src/state/store.ts`, replace everything from `const workspacesRaw =` down to the closing of the `hydratedMode` block (lines 51–86) with:

```ts
  const {
    document: hydrated,
    persistDisabled,
    foldedFromLegacy,
  } = hydrateDocument(options);

  const hydratedWorkspaces = deserializeWorkspaces(hydrated.workspaces, serializers);
  const hydratedSnapshots = hydrated.saves;
  const hydratedLayout = hydrated.layout;
  const hydratedMode = hydrated.mode;
```

and add this function below `createLabStore` (it needs nothing from the
closure):

```ts
interface HydrateResult {
  document: LabDocument;
  /** True when the stored document is newer than this code understands.
   *  Flushing would clobber it, so the store stops persisting. */
  persistDisabled: boolean;
  foldedFromLegacy: boolean;
}

function hydrateDocument(options: CreateLabStoreOptions): HydrateResult {
  const fallback = emptyDocument(options.initialMode ?? 'auto');
  const raw = options.storage.read(labDocumentKey(options.storageKey));

  let parsed: Record<string, unknown> | null = null;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.warn('[labkit] lab document is unparseable; quarantining it');
      options.storage.write(quarantineKey(options.storageKey), raw);
      return { document: fallback, persistDisabled: false, foldedFromLegacy: false };
    }
  } else {
    parsed = readLegacyDocument(options.storage, options.storageKey);
  }

  if (parsed === null) {
    return { document: fallback, persistDisabled: false, foldedFromLegacy: false };
  }

  const foldedFromLegacy = raw === null;
  const outcome = runMigrations(parsed, MIGRATIONS, CURRENT_DOCUMENT_VERSION);

  if (!outcome.ok) {
    if (outcome.reason === 'future') {
      console.warn(
        '[labkit] lab document is from a newer version of labkit; starting empty and leaving it alone',
      );
      return { document: fallback, persistDisabled: true, foldedFromLegacy: false };
    }
    console.warn('[labkit] lab document failed to migrate; quarantining it', outcome.error);
    options.storage.write(quarantineKey(options.storageKey), JSON.stringify(parsed));
    return { document: fallback, persistDisabled: false, foldedFromLegacy: false };
  }

  return {
    document: outcome.doc as unknown as LabDocument,
    persistDisabled: false,
    foldedFromLegacy,
  };
}
```

Update the imports at the top of `src/state/store.ts`:

```ts
import {
  CURRENT_DOCUMENT_VERSION,
  deleteLegacyKeys,
  emptyDocument,
  labDocumentKey,
  MIGRATIONS,
  quarantineKey,
  readLegacyDocument,
  runMigrations,
} from './document';
import { deserializeWorkspaces, emptyUndoStack, serializeWorkspaces } from './helpers';
import type { LabDocument /* ...existing */ } from './types';
```

`labStorageKey` is no longer imported by `store.ts`; `document.ts` owns the
legacy names now.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS. Deleting the legacy keys happens on the first flush, which is
Task 6 — nothing here asserts it yet.

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "hydrate a lab store from one versioned document"
```

---

### Task 6: Flush the document

**Files:**
- Modify: `src/state/store.ts:229-245` (`scheduleFlush`)
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/state/store.test.ts`:

```ts
describe('createLabStore — flushing', () => {
  it('writes one document and no legacy keys', async () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    const doc = JSON.parse(storage.read(labDocumentKey('test')) as string);
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION);
    expect(doc.mode).toBe('light');
  });

  it('deletes the legacy keys once the folded document is written', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    storage.write(labStorageKey('test', 'workspaces'), JSON.stringify([]));
    storage.write(labStorageKey('test', 'theme'), 'interstellar');

    const s = makeStore({ storage });
    s.getState().setMode('dark');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).not.toBeNull();
    expect(storage.read(labStorageKey('test', 'workspaces'))).toBeNull();
    expect(storage.read(labStorageKey('test', 'theme'))).toBeNull();
  });

  it('does not write when the stored document is from the future', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const future = JSON.stringify({ version: 999 });
    storage.write(labDocumentKey('test'), future);

    const s = makeStore({ storage });
    s.getState().setMode('light');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(storage.read(labDocumentKey('test'))).toBe(future);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — the flush still writes four keys, so `labDocumentKey` reads back null.

- [ ] **Step 3: Write minimal implementation**

Replace `scheduleFlush` in `src/state/store.ts`:

```ts
  function scheduleFlush(): void {
    if (persistDisabled) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      const s = store.getState();
      const document: LabDocument = {
        version: CURRENT_DOCUMENT_VERSION,
        workspaces: serializeWorkspaces(s.workspaces, serializers),
        saves: s.savedSnapshots,
        layout: s.layout,
        mode: s.mode,
      };
      options.storage.write(labDocumentKey(options.storageKey), JSON.stringify(document));
      if (foldedFromLegacy) deleteLegacyKeys(options.storage, options.storageKey);
      flushTimer = null;
    }, 300);
  }
```

The legacy keys are deleted only after the document is written, so an
interrupted fold loses nothing.

- [ ] **Step 4: Run the whole state suite**

Run: `npx vitest run src/state/`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "persist a lab as one versioned document"
```

---

### Task 7: Export the document surface and typecheck

**Files:**
- Modify: `src/state/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add the exports**

In `src/state/index.ts`:

```ts
export {
  CURRENT_DOCUMENT_VERSION,
  labDocumentKey,
  quarantineKey,
} from './document';
export type { LabDocument, Migration, SerializedTrial } from './types';
```

In `src/index.ts`, add to the existing type export block from `./state`:

```ts
  LabDocument,
  SerializedTrial,
```

`MIGRATIONS`, `migrateV0toV1`, `readLegacyDocument`, `deleteLegacyKeys` and
`runMigrations` stay internal — they are the chain's implementation, and a
consumer reaching for them is a consumer about to collide with the next
version bump.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Build, to prove the published types still resolve**

Run: `npm run build`
Expected: completes; `dist/index.d.ts` contains `LabDocument`.

- [ ] **Step 5: Commit**

```bash
git add src/state/index.ts src/index.ts
git commit -m "export the lab document type and its version"
```

---

### Task 8: Changeset

**Files:**
- Create: `.changeset/versioned-lab-document.md` at the repo root

- [ ] **Step 1: Write the changeset**

Every changeset in this repo is `patch` — see the root `CLAUDE.md`. Create
`.changeset/versioned-lab-document.md` at the **repo root**, not in the
package:

```markdown
---
'@weasel-js/labkit': patch
---

Persist a lab as one versioned document rather than four loose keys.

`lk:<storageKey>` now holds `{version, workspaces, saves, layout, mode}` and
hydration runs a migration chain over it. A lab saved under the previous four
keys is folded into the document on first load and the old keys are removed;
nothing is lost. A document written by a newer labkit than the one reading it
is left alone and that store stops persisting, rather than being overwritten.
A document that fails to parse or migrate is set aside under
`lk:<storageKey>:quarantine`.

`serializeWorkspaces` and `deserializeWorkspaces` now take and return records
rather than a JSON string. Both are internal to the state runtime.
```

- [ ] **Step 2: Verify the bump level**

Run: `npm run check:bumps` (from the repo root)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .changeset/versioned-lab-document.md
git commit -m "add a changeset for the versioned lab document"
```

---

## Out of scope, and why

**`registerSerializers` has no callers.** `createLabStore` initializes
`serializers` to `{}` and nothing in labkit, its examples, or any app in the
repo ever calls `registerSerializers`. So `Instrument.serialize` /
`deserialize` never run — not at flush, not at hydrate. This plan preserves
that behavior exactly rather than quietly changing it: migrations operate on
already-serialized JSON, so the document work neither depends on the path nor
repairs it. It needs its own fix, and its own decision about where the
instrument list reaches the store — `createLabStore` runs before any React
provider mounts, so a working version likely takes serializers as a
constructor option rather than a late registration.

**Compressing the URL hash.** `encodeUrlHash` is
`btoa(encodeURIComponent(value))`. A whole lab in a fragment will exceed what
browsers honor. The spec names the limit; raising it is separate work.
