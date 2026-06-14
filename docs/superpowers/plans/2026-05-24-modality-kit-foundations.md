# Modality Kit Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the kit-side foundations for modality: extract `History` into a `weasel-history` package, add the `Journal` primitive, and stand up a `weasel-modes` package with capability tags, mode definitions, the six stock-mode data records, and a mode-owned decoration layer. No user-visible behavior change; pure kit machinery + tests.

**Architecture:** Four phases. Phase 1 mechanically extracts `History` into its own package with no API changes — every existing test still passes. Phase 2 adds the `Journal` class alongside `History`, using a private inner `History` for the journal's own undo stack and a new `parent.recordEntry(ops, label)` to flush on commit without re-applying. Phase 3 stands up `weasel-modes` with capability-tag types, `ModeDefinition`, a registry, and the six stock-mode data records. Phase 4 adds the mode-owned decoration layer — a render-layer slot whose content is supplied by the active mode rather than any tool.

**Tech Stack:** TypeScript, npm workspaces, vitest, the existing weasel kit conventions (path-aliased imports, `@weasel-js/*` package names, `RenderLayer` shape from `core/layers/render`).

**Spec:** `docs/superpowers/specs/2026-05-24-modality-design.md`

---

## File structure overview

After this plan:

```
packages/history/
  package.json
  tsconfig.json
  src/
    index.ts              — public surface
    history.ts            — moved from src/core/history/history.ts; adds recordEntry, allForwardOps
    history.test.ts       — moved from src/core/history/history.test.ts
    journal.ts            — new: Journal class
    journal.test.ts       — new

packages/modes/
  package.json
  tsconfig.json
  src/
    index.ts
    capabilities.ts       — CapabilityTag type + IMPLICIT_TAGS constant
    modeDefinition.ts     — ModeDefinition interface
    registry.ts           — createModeRegistry
    decorations.ts        — mode-owned decoration layer adapter
    presets/
      default.ts          — the six stock modes
    *.test.ts

src/
  core/
    history/              — DELETED
    applyOps.ts           — unchanged
  interactions/actions/depSchema.ts  — import path updated
  index.ts                — re-export updated to point at @weasel-js/history
```

---

## Phase 1: Extract `weasel-history` package

No behavior change. Mechanical move + import updates. All existing history tests must remain green.

### Task 1: Scaffold the `weasel-history` package

**Files:**
- Create: `packages/history/package.json`
- Create: `packages/history/tsconfig.json`
- Create: `packages/history/src/index.ts` (empty for now)

- [ ] **Step 1: Verify the parent directory exists**

Run: `ls packages/`
Expected: includes `weasel-gestures`, `weasel-ui`, `weasel-hud`, etc.

- [ ] **Step 2: Create the package directory and files**

```bash
mkdir -p packages/history/src
```

- [ ] **Step 3: Create `packages/history/package.json`**

```json
{
  "name": "@weasel-js/history",
  "version": "0.0.0",
  "private": true,
  "description": "Undo/redo history with scoped sub-history (Journal) primitive. No React, no DOM.",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./package.json": "./package.json"
  }
}
```

- [ ] **Step 4: Create `packages/history/tsconfig.json`**

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

- [ ] **Step 5: Create empty `packages/history/src/index.ts`**

```ts
// Public surface populated in Task 2.
export {};
```

- [ ] **Step 6: Verify npm picks up the workspace**

Run: `npm install`
Expected: no errors; `node_modules/@weasel-js/history` is a symlink to `packages/history`.

- [ ] **Step 7: Commit**

```bash
git add packages/history
git commit -m "chore(weasel-history): scaffold package"
```

### Task 2: Move `History` source files into the package

**Files:**
- Move: `src/core/history/history.ts` → `packages/history/src/history.ts`
- Move: `src/core/history/history.test.ts` → `packages/history/src/history.test.ts`
- Move: `src/core/history/index.ts` → `packages/history/src/index.ts` (overwrite scaffold)

The moved files import `Op` and `rebuildOp` from `core/ops/...` and a debug helper from `debug/flag`. After the move those imports become cross-package imports.

- [ ] **Step 1: Git-move the source files**

```bash
git mv src/core/history/history.ts packages/history/src/history.ts
git mv src/core/history/history.test.ts packages/history/src/history.test.ts
git mv src/core/history/index.ts packages/history/src/index.ts
```

- [ ] **Step 2: Verify the old directory is empty, then remove it**

```bash
ls src/core/history/  # should be empty
rmdir src/core/history/
```

- [ ] **Step 3: Fix imports in `packages/history/src/history.ts`**

The file currently has:
```ts
import type { Op } from '../ops/types';
import { rebuildOp } from '../ops/registry';
import { dwarn, dlog } from '../../debug/flag';
```

Change to path-aliased imports (these aliases resolve to `src/...` from any package):
```ts
import type { Op } from 'core/ops/types';
import { rebuildOp } from 'core/ops/registry';
import { dwarn, dlog } from 'debug/flag';
```

- [ ] **Step 4: Fix imports in `packages/history/src/history.test.ts`**

Locate any `from '../...'` or `from './history'` imports. The relative imports inside the package stay relative; cross-package imports (any reaching into `core/...`, `debug/...`, etc.) become path-aliased.

Run: `grep -n "^import" packages/history/src/history.test.ts`
For each result whose path goes outside `packages/history/src/`, convert to a path alias (`core/...`, `debug/...`, etc.). Imports inside the package use relative paths.

- [ ] **Step 5: Run history tests in-place**

Run: `npx vitest run packages/history/src/history.test.ts`
Expected: PASS — all existing history tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/history src/core/history
git commit -m "refactor(weasel-history): move History source from core into package"
```

### Task 3: Update consumers of the old `core/history` import path

**Files:**
- Modify: `src/index.ts:434`
- Modify: `src/interactions/actions/depSchema.ts:34`

- [ ] **Step 1: Update `src/index.ts` re-export**

Find the line (around `:434`):
```ts
export * from './core/history';
```

Change to:
```ts
export * from '@weasel-js/history';
```

- [ ] **Step 2: Update `src/interactions/actions/depSchema.ts` type import**

Find (around `:34`):
```ts
import type { History } from 'core/history/history';
```

Change to:
```ts
import type { History } from '@weasel-js/history';
```

- [ ] **Step 3: Sweep for any other lingering importers**

Run: `grep -rn "from.*core/history\|from '../history\|from './history'" src/ apps/ --include="*.ts" --include="*.tsx"`
Expected: no results (or only inside files you've already updated).

If any results appear, update them the same way: the public surface is `@weasel-js/history`.

- [ ] **Step 4: Typecheck the whole repo**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add src apps
git commit -m "refactor(history): point consumers at @weasel-js/history"
```

---

## Phase 2: Build the `Journal` primitive

A `Journal` is a scoped sub-history. While active, it holds its own undo/redo stack; on commit, the net forward ops collapse to a single entry on the parent. Cancel rolls the scene back via inverses. Suspend keeps the state intact for later resume.

Architectural shape (locked in here so all tasks below are consistent):

- The public API surface matches the spec: `history.beginJournal({ targetId?, label })` returns a `Journal`, and `history.resumeJournal(journal)` re-activates a suspended one. These are methods on `History`, not free functions.
- Internally, `journal.ts` exports a `createJournalInternal(parent, adapter, opts)` factory used only by `createHistory`; the journal interface methods are owned by `History`'s implementation.
- `Journal` owns a private inner `History` instance, created against the same adapter as the parent. All apply/undo/redo route through the inner.
- `Journal.commit(label)` collects the inner's net forward ops (concatenated forwardOps of every undo-stack entry, in order), then calls `parent.recordEntry(netOps, label)` — a new method that pushes a history entry without re-applying.
- `Journal.cancel()` calls `inner.goto(0)` to replay inverses on the adapter, then closes.
- `Journal.suspend()` closes the active state but keeps the inner intact. Resume re-attaches via `parent.resumeJournal(journal)`.
- The parent tracks the active journal via a private field; while non-null, calls intended for the parent's `applyOps` route to the journal at the *caller's* layer (the caller is the canvas/ctx, not the history itself). This plan does NOT plumb that routing — that's a Phase 2 task in the WeaselDraw integration plan. Here we only build the `Journal` class and the parent-side hooks it needs.

### Task 4: Add `History.recordEntry(ops, label)` — push without applying

**Files:**
- Modify: `packages/history/src/history.ts`
- Test: `packages/history/src/history.recordEntry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/history.recordEntry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function makeArrayAdapter(): { values: number[] } {
  return { values: [] };
}

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) {
      a.values.push(value);
    },
    invert() {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) {
          a.values.pop();
        },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('History.recordEntry', () => {
  it('pushes an undo entry without applying the ops', () => {
    const adapter = makeArrayAdapter();
    const h = createHistory(adapter);

    // Pre-apply the op manually
    const op = pushOp(1);
    op.apply(adapter);
    expect(adapter.values).toEqual([1]);

    // recordEntry should NOT re-apply
    h.recordEntry([op], 'manual');
    expect(adapter.values).toEqual([1]);
    expect(h.canUndo()).toBe(true);
  });

  it('the recorded entry is undoable — invert rolls the scene back', () => {
    const adapter = makeArrayAdapter();
    const h = createHistory(adapter);

    const op = pushOp(42);
    op.apply(adapter);
    h.recordEntry([op], 'manual');

    h.undo();
    expect(adapter.values).toEqual([]);
    expect(h.canRedo()).toBe(true);
  });

  it('the recorded entry is redoable — re-applying restores state', () => {
    const adapter = makeArrayAdapter();
    const h = createHistory(adapter);

    const op = pushOp(7);
    op.apply(adapter);
    h.recordEntry([op], 'manual');
    h.undo();
    expect(adapter.values).toEqual([]);

    h.redo();
    expect(adapter.values).toEqual([7]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/history.recordEntry.test.ts`
Expected: FAIL with `h.recordEntry is not a function`.

- [ ] **Step 3: Add `recordEntry` to the `History` interface in `history.ts`**

Inside the `History` interface (around line 62 in the file), add:
```ts
  /** Push an entry whose ops have already been applied to the adapter.
   *  Unlike `applyOps`, does NOT call `op.apply()`. Used by Journal.commit
   *  to flush a session's net forward ops to the parent as one entry without
   *  re-mutating the scene. */
  recordEntry(ops: Op[], label: string): void;
```

- [ ] **Step 4: Implement `recordEntry` in `createHistory`'s returned object**

Inside the returned object literal (next to `apply`, `applyOps`, etc.), add:
```ts
    recordEntry(ops: Op[], label: string): void {
      if (ops.length === 0) return;
      undoStack.push({ id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now() });
      redoStack.length = 0;
      bump();
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/history/src/history.recordEntry.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full history suite to verify no regressions**

Run: `npx vitest run packages/history/src/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): add History.recordEntry for preapplied push"
```

### Task 5: Add `History.allForwardOps()` — snapshot the current net forward ops

**Files:**
- Modify: `packages/history/src/history.ts`
- Test: `packages/history/src/history.allForwardOps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/history.allForwardOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('History.allForwardOps', () => {
  it('returns empty when the undo stack is empty', () => {
    const h = createHistory({ values: [] });
    expect(h.allForwardOps()).toEqual([]);
  });

  it('returns all forward ops across all undo entries, in order', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'a');
    h.applyOps([pushOp(2), pushOp(3)], 'b');
    h.applyOps([pushOp(4)], 'c');

    const ops = h.allForwardOps();
    expect(ops.length).toBe(4);
    expect(ops.map((o) => (o.args as { value: number }).value)).toEqual([1, 2, 3, 4]);
  });

  it('excludes ops from undone (redo-stack) entries', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'a');
    h.applyOps([pushOp(2)], 'b');
    h.undo();

    const ops = h.allForwardOps();
    expect(ops.length).toBe(1);
    expect((ops[0].args as { value: number }).value).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/history.allForwardOps.test.ts`
Expected: FAIL — `h.allForwardOps is not a function`.

- [ ] **Step 3: Add `allForwardOps` to the `History` interface**

In the interface block:
```ts
  /** Concatenated forwardOps of every undo-stack entry, in order. Snapshot
   *  of "what changes are currently applied via this history" — useful for
   *  Journal.commit to flush to a parent, and for any caller that wants to
   *  diff against a baseline. */
  allForwardOps(): Op[];
```

- [ ] **Step 4: Implement `allForwardOps` in `createHistory`**

Inside the returned object literal:
```ts
    allForwardOps(): Op[] {
      const out: Op[] = [];
      for (const e of undoStack) {
        for (const op of e.forwardOps) out.push(op);
      }
      return out;
    },
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/history/src/history.allForwardOps.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full history suite**

Run: `npx vitest run packages/history/src/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): add History.allForwardOps snapshot"
```

### Task 6: Define the `Journal` interface and `history.beginJournal`

**Files:**
- Create: `packages/history/src/journal.ts`
- Modify: `packages/history/src/history.ts` (add `beginJournal` method; keep `adapter` reference for the new method)
- Modify: `packages/history/src/index.ts`
- Test: `packages/history/src/journal.skeleton.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.skeleton.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('history.beginJournal — Journal skeleton', () => {
  it('beginJournal returns a Journal with the documented surface', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'test', targetId: 'foo' });

    expect(typeof j.applyBatch).toBe('function');
    expect(typeof j.undo).toBe('function');
    expect(typeof j.redo).toBe('function');
    expect(typeof j.canUndo).toBe('function');
    expect(typeof j.canRedo).toBe('function');
    expect(typeof j.entries).toBe('function');
    expect(typeof j.commit).toBe('function');
    expect(typeof j.cancel).toBe('function');
    expect(typeof j.suspend).toBe('function');
    expect(j.targetId).toBe('foo');
    expect(j.forkedAtEntryId).toBeGreaterThanOrEqual(0);
    expect(j.isActive()).toBe(true);
  });

  it('newly-created journal has no undo or redo', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'test' });

    expect(j.canUndo()).toBe(false);
    expect(j.canRedo()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.skeleton.test.ts`
Expected: FAIL — `Cannot find module './journal'`.

- [ ] **Step 3: Create `packages/history/src/journal.ts`**

```ts
import type { Op } from 'core/ops/types';
import { createHistory, type History, type HistoryEntry } from './history';

export interface BeginJournalOptions {
  label: string;
  targetId?: string;
}

export interface Journal {
  readonly targetId: string | undefined;
  readonly forkedAtEntryId: number;

  // Same operational surface as History
  applyBatch(ops: Op[], label: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  entries(): { undo: HistoryEntry[]; redo: HistoryEntry[] };

  // Lifecycle
  commit(label: string): void;
  cancel(): void;
  suspend(): void;
  isActive(): boolean;
}

/** Internal factory used by `createHistory`'s `beginJournal` method.
 *  Not exported via the package's `index.ts` — callers go through
 *  `history.beginJournal()`. */
export function createJournalInternal(
  parent: History,
  adapter: unknown,
  opts: BeginJournalOptions,
): Journal {
  const inner = createHistory(adapter);
  const forkedAtEntryId = parent.currentEntryId();  // updated in Task 12; for now reads a method we'll add below
  let active = true;
  const targetId = opts.targetId;

  return {
    targetId,
    forkedAtEntryId,

    applyBatch(_ops: Op[], _label: string): void {
      throw new Error('Journal.applyBatch not yet implemented');
    },
    undo(): void {
      throw new Error('Journal.undo not yet implemented');
    },
    redo(): void {
      throw new Error('Journal.redo not yet implemented');
    },
    canUndo(): boolean {
      return inner.canUndo();
    },
    canRedo(): boolean {
      return inner.canRedo();
    },
    entries() {
      return inner.entries();
    },
    commit(_label: string): void {
      throw new Error('Journal.commit not yet implemented');
    },
    cancel(): void {
      throw new Error('Journal.cancel not yet implemented');
    },
    suspend(): void {
      throw new Error('Journal.suspend not yet implemented');
    },
    isActive(): boolean {
      return active;
    },
  };
}
```

Note: `parent.currentEntryId()` is added formally in Task 12; if Task 12 hasn't run yet, the engineer can temporarily use `0` here — it gets corrected when Task 12 lands. To avoid this ordering hazard, simply add `currentEntryId()` to History as part of *this* task instead.

**Decision (do this now):** Add `currentEntryId()` to History in this task. The Task-12 test becomes a verification of `forkedAtEntryId` semantics rather than introducing the method:

In `history.ts`, in the `History` interface:
```ts
  currentEntryId(): number;
```

In the `createHistory` returned object:
```ts
    currentEntryId(): number {
      return nextEntryId;
    },
```

- [ ] **Step 4: Add `beginJournal` to History**

In `packages/history/src/history.ts`:

Add an import at the top:
```ts
import { createJournalInternal, type Journal, type BeginJournalOptions } from './journal';
```

Add to the `History` interface:
```ts
  /** Open a scoped sub-history. All apply/undo/redo on the returned Journal
   *  affect the same adapter; on commit, the Journal's net forward ops are
   *  flushed to this History as one entry. See spec docs/superpowers/specs/
   *  2026-05-24-modality-design.md for the full lifecycle. */
  beginJournal(opts: BeginJournalOptions): Journal;
```

In the `createHistory` returned object literal, add:
```ts
    beginJournal(opts: BeginJournalOptions): Journal {
      // `adapter` is the closure-captured adapter passed to createHistory.
      // The returned History object's `this` doesn't carry it, so we pass
      // it through to the factory directly.
      return createJournalInternal(this, adapter, opts);
    },
```

Note: `this` inside the method refers to the returned History object. If TS or runtime complains about `this`, use the explicit `outerHistory` pattern: capture `const self: History = …` after the object literal is constructed and pass that.

- [ ] **Step 5: Update `packages/history/src/index.ts` to export Journal types**

Append to existing exports:
```ts
export type { Journal, BeginJournalOptions } from './journal';
```

Note: `createJournalInternal` is intentionally NOT exported — the public way to make a Journal is `parent.beginJournal()`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/history/src/journal.skeleton.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): Journal skeleton with stub methods"
```

### Task 7: Implement `Journal.applyBatch`, `undo`, `redo`

Delegate to the inner history.

**Files:**
- Modify: `packages/history/src/journal.ts`
- Test: `packages/history/src/journal.applyBatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.applyBatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('Journal.applyBatch / undo / redo', () => {
  it('applyBatch applies ops to the adapter and records on the inner history', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    expect(adapter.values).toEqual([1]);
    expect(j.canUndo()).toBe(true);
    expect(j.canRedo()).toBe(false);
  });

  it('applyBatch does NOT push to the parent history', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    expect(parent.canUndo()).toBe(false);
  });

  it('undo replays inverses on the adapter via the inner', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    j.applyBatch([pushOp(2)], 'second');
    expect(adapter.values).toEqual([1, 2]);

    j.undo();
    expect(adapter.values).toEqual([1]);
    j.undo();
    expect(adapter.values).toEqual([]);
  });

  it('redo re-applies forward ops', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    j.undo();
    expect(adapter.values).toEqual([]);

    j.redo();
    expect(adapter.values).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.applyBatch.test.ts`
Expected: FAIL — `Journal.applyBatch not yet implemented`.

- [ ] **Step 3: Implement applyBatch / undo / redo in `journal.ts`**

Replace the stub methods:
```ts
    applyBatch(ops: Op[], label: string): void {
      if (!active) throw new Error('Journal is closed; cannot applyBatch');
      inner.applyOps(ops, label);
    },
    undo(): void {
      if (!active) throw new Error('Journal is closed; cannot undo');
      inner.undo();
    },
    redo(): void {
      if (!active) throw new Error('Journal is closed; cannot redo');
      inner.redo();
    },
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/history/src/journal.applyBatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): Journal.applyBatch/undo/redo delegate to inner"
```

### Task 8: Implement `Journal.commit`

**Files:**
- Modify: `packages/history/src/journal.ts`
- Test: `packages/history/src/journal.commit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.commit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('Journal.commit', () => {
  it('flushes net forward ops to parent as one entry without re-applying', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2), pushOp(3)], 'b');
    expect(adapter.values).toEqual([1, 2, 3]);

    j.commit('Edit Path');

    // Scene unchanged by commit itself
    expect(adapter.values).toEqual([1, 2, 3]);
    // Parent has exactly one new entry
    expect(parent.entries().undo.length).toBe(1);
    expect(parent.entries().undo[0].label).toBe('Edit Path');
  });

  it('parent undo after commit rolls back the entire session', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    j.commit('Edit');

    parent.undo();
    expect(adapter.values).toEqual([]);
  });

  it('journal is closed after commit; further calls throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.commit('Edit');

    expect(j.isActive()).toBe(false);
    expect(() => j.applyBatch([pushOp(2)], 'x')).toThrow();
  });

  it('committing an empty journal pushes nothing to parent', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.commit('Empty');

    expect(parent.entries().undo.length).toBe(0);
    expect(j.isActive()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.commit.test.ts`
Expected: FAIL — `Journal.commit not yet implemented`.

- [ ] **Step 3: Implement commit**

Replace the stub:
```ts
    commit(label: string): void {
      if (!active) throw new Error('Journal already closed');
      const netOps = inner.allForwardOps();
      if (netOps.length > 0) {
        parent.recordEntry(netOps, label);
      }
      active = false;
    },
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/history/src/journal.commit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): Journal.commit flushes net ops to parent"
```

### Task 9: Implement `Journal.cancel`

**Files:**
- Modify: `packages/history/src/journal.ts`
- Test: `packages/history/src/journal.cancel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.cancel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('Journal.cancel', () => {
  it('rolls the scene back via inverses and pushes nothing to parent', () => {
    const adapter = { values: [10] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    expect(adapter.values).toEqual([10, 1, 2]);

    j.cancel();

    expect(adapter.values).toEqual([10]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('closes the journal; further calls throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.cancel();

    expect(j.isActive()).toBe(false);
    expect(() => j.commit('after')).toThrow();
  });

  it('cancel on an empty journal is a no-op', () => {
    const adapter = { values: [5] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.cancel();
    expect(adapter.values).toEqual([5]);
    expect(parent.entries().undo.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.cancel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement cancel**

Replace the stub:
```ts
    cancel(): void {
      if (!active) throw new Error('Journal already closed');
      inner.goto(0);
      active = false;
    },
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/history/src/journal.cancel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): Journal.cancel rolls scene back via inner.goto(0)"
```

### Task 10: Implement `Journal.suspend`

Suspend keeps the inner intact for later resume. The journal is no longer "active" — applyBatch/undo/redo throw — but its state is preserved.

**Files:**
- Modify: `packages/history/src/journal.ts`
- Test: `packages/history/src/journal.suspend.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.suspend.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('Journal.suspend', () => {
  it('marks the journal inactive but leaves the scene untouched', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.suspend();

    expect(j.isActive()).toBe(false);
    expect(adapter.values).toEqual([1]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('further operations on a suspended journal throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.suspend();

    expect(() => j.applyBatch([pushOp(1)], 'x')).toThrow();
    expect(() => j.undo()).toThrow();
    expect(() => j.redo()).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.suspend.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement suspend**

Replace the stub:
```ts
    suspend(): void {
      if (!active) throw new Error('Journal already closed');
      active = false;
    },
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/history/src/journal.suspend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): Journal.suspend preserves state for resume"
```

### Task 11: Implement `history.resumeJournal` — reactivate a suspended journal

Per spec, `resumeJournal` is a method on `History`, not a free function. Staleness checking is the *caller's* responsibility — the journal exposes `forkedAtEntryId` for the caller to consult against `history.currentEntryId()`; the kit does not check op-semantic staleness.

The journal needs a tristate (`'active' | 'suspended' | 'closed'`) so we can distinguish "suspended (resumable)" from "closed (committed or cancelled — not resumable)". The History method calls a non-public hook on the journal to flip the state back.

**Files:**
- Modify: `packages/history/src/journal.ts`
- Modify: `packages/history/src/history.ts` (add `resumeJournal` method)
- Test: `packages/history/src/journal.resume.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/history/src/journal.resume.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('history.resumeJournal', () => {
  it('re-activates a suspended journal so applyBatch works again', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.suspend();

    parent.resumeJournal(j);
    expect(j.isActive()).toBe(true);
    j.applyBatch([pushOp(2)], 'b');
    expect(adapter.values).toEqual([1, 2]);
  });

  it('the resumed journal preserves its inner undo stack — undo reaches pre-suspend state', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    j.suspend();

    parent.resumeJournal(j);
    j.undo();
    expect(adapter.values).toEqual([1]);
    j.undo();
    expect(adapter.values).toEqual([]);
  });

  it('resuming an already-committed journal throws', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.commit('x');

    expect(() => parent.resumeJournal(j)).toThrow();
  });

  it('resuming an already-cancelled journal throws', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.cancel();

    expect(() => parent.resumeJournal(j)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/history/src/journal.resume.test.ts`
Expected: FAIL — `parent.resumeJournal is not a function`.

- [ ] **Step 3: Refactor journal state to a tristate; add a resume hook**

In `packages/history/src/journal.ts`:

Replace `let active = true;` with:
```ts
type State = 'active' | 'suspended' | 'closed';
let state: State = 'active';
```

Update the methods to consult `state`:
- `applyBatch`, `undo`, `redo`: throw `'Journal is not active'` unless `state === 'active'`.
- `commit`: throw `'Journal already closed'` if `state === 'closed'`. After flushing, set `state = 'closed'`.
- `cancel`: throw `'Journal already closed'` if `state === 'closed'`. After rollback, set `state = 'closed'`.
- `suspend`: throw `'Journal is not active'` unless `state === 'active'`. Set `state = 'suspended'`.
- `isActive`: `return state === 'active';`

Add a module-level WeakMap so `History.resumeJournal` can flip the state back without exposing the internal:

At the top of `journal.ts`:
```ts
const RESUMERS = new WeakMap<Journal, () => void>();

/** Called by `history.resumeJournal`. Not part of the public API. */
export function _resumeJournalInternal(j: Journal): void {
  const r = RESUMERS.get(j);
  if (!r) throw new Error('Journal is not resumable (already committed or cancelled)');
  r();
}
```

In `createJournalInternal`, build the journal object as a `const journal: Journal = { ... }`, then *after* the object is constructed:
```ts
RESUMERS.set(journal, () => {
  if (state !== 'suspended') throw new Error('Journal is not suspended');
  state = 'active';
});

return journal;
```

In the `commit` and `cancel` method bodies, after setting `state = 'closed'`, add:
```ts
RESUMERS.delete(journal);
```

(The `journal` const is in scope because it's captured by closure from the outer function.)

- [ ] **Step 4: Add `resumeJournal` to History**

In `packages/history/src/history.ts`:

Update the import line at the top of the file:
```ts
import { createJournalInternal, _resumeJournalInternal, type Journal, type BeginJournalOptions } from './journal';
```

Add to the `History` interface:
```ts
  /** Re-activate a suspended journal. Throws if the journal was committed or
   *  cancelled (those are terminal). Staleness checking is the caller's
   *  responsibility — consult `journal.forkedAtEntryId` against
   *  `currentEntryId()` and your own op-semantic rules to decide whether
   *  to resume or discard before calling this. */
  resumeJournal(journal: Journal): void;
```

In the `createHistory` returned object literal:
```ts
    resumeJournal(journal: Journal): void {
      _resumeJournalInternal(journal);
    },
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/history/src/journal.resume.test.ts`
Expected: PASS.

- [ ] **Step 6: Run all weasel-history tests**

Run: `npx vitest run packages/history/src/`
Expected: PASS — no regressions in earlier journal tests.

- [ ] **Step 7: Commit**

```bash
git add packages/history/src
git commit -m "feat(weasel-history): history.resumeJournal re-activates suspended journals"
```

### Task 12: Verify `forkedAtEntryId` semantics

`currentEntryId()` was added in Task 6 and `forkedAtEntryId` is set from it in `createJournalInternal`. This task is verification-only — write the semantic tests against the existing implementation. If the tests fail, the engineer fixes the implementation (most likely there's a subtle off-by-one in how `nextEntryId` is captured or how `currentEntryId` reports it).

**Files:**
- Test: `packages/history/src/journal.forkPoint.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/history/src/journal.forkPoint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('forkedAtEntryId', () => {
  it('captures the parent\'s current entry-id frontier at journal creation', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);

    parent.applyOps([pushOp(1)], 'a');
    parent.applyOps([pushOp(2)], 'b');
    const frontier = parent.currentEntryId();

    const j = parent.beginJournal({ label: 's' });
    expect(j.forkedAtEntryId).toBe(frontier);
  });

  it('subsequent parent ops do not change a journal\'s forkedAtEntryId', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);

    const j = parent.beginJournal({ label: 's' });
    const captured = j.forkedAtEntryId;

    parent.applyOps([pushOp(99)], 'after-fork');

    expect(j.forkedAtEntryId).toBe(captured);
    expect(parent.currentEntryId()).toBeGreaterThan(captured);
  });
});
```

- [ ] **Step 2: Run the test — should PASS against the Task-6 implementation**

Run: `npx vitest run packages/history/src/journal.forkPoint.test.ts`
Expected: PASS.

If it fails, fix the implementation:
- Verify `currentEntryId()` in `history.ts` returns `nextEntryId` (not `nextEntryId - 1`).
- Verify `createJournalInternal` in `journal.ts` sets `forkedAtEntryId` from `parent.currentEntryId()` (not from `allForwardOps().length` or any earlier placeholder).

The legacy placeholder code that this task replaces is `parent.allForwardOps().length`; check it has been replaced. Reference (verify against the actual code):
```ts
const forkedAtEntryId = parent.allForwardOps().length;
```

Reference correct line in `createJournalInternal`:
```ts
const forkedAtEntryId = parent.currentEntryId();
```

- [ ] **Step 3: Run the full weasel-history suite**

Run: `npx vitest run packages/history/src/`
Expected: PASS.

- [ ] **Step 4: Commit (only if any changes were made; otherwise skip)**

If the implementation was already correct in Task 6, the only change here is the new test file:
```bash
git add packages/history/src/journal.forkPoint.test.ts
git commit -m "test(weasel-history): forkedAtEntryId semantics"
```

---

## Phase 3: Scaffold `weasel-modes` package

### Task 13: Scaffold the `weasel-modes` package

**Files:**
- Create: `packages/modes/package.json`
- Create: `packages/modes/tsconfig.json`
- Create: `packages/modes/src/index.ts`

- [ ] **Step 1: Create the package directory**

```bash
mkdir -p packages/modes/src/presets
```

- [ ] **Step 2: Create `packages/modes/package.json`**

```json
{
  "name": "@weasel-js/modes",
  "version": "0.0.0",
  "private": true,
  "description": "App-level modality primitives: capability tags, mode definitions, mode registry, and decoration layer.",
  "license": "MIT",
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./presets/default": {
      "import": "./src/presets/default.ts",
      "types": "./src/presets/default.ts"
    },
    "./package.json": "./package.json"
  }
}
```

- [ ] **Step 3: Create `packages/modes/tsconfig.json`**

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

- [ ] **Step 4: Create `packages/modes/src/index.ts`**

```ts
// Public surface populated in later tasks.
export {};
```

- [ ] **Step 5: Verify workspace picks it up**

Run: `npm install`
Expected: no errors; `node_modules/@weasel-js/modes` symlinks to the package.

- [ ] **Step 6: Commit**

```bash
git add packages/modes
git commit -m "chore(weasel-modes): scaffold package"
```

### Task 14: Define the `CapabilityTag` type and `IMPLICIT_TAGS`

**Files:**
- Create: `packages/modes/src/capabilities.ts`
- Modify: `packages/modes/src/index.ts`
- Test: `packages/modes/src/capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/modes/src/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_TAGS, IMPLICIT_TAGS, isCapabilityTag } from './capabilities';

describe('capabilities', () => {
  it('ALL_TAGS includes the documented capability vocabulary', () => {
    expect(ALL_TAGS).toContain('navigation');
    expect(ALL_TAGS).toContain('selection');
    expect(ALL_TAGS).toContain('creates-paths');
    expect(ALL_TAGS).toContain('creates-shapes');
    expect(ALL_TAGS).toContain('creates-text');
    expect(ALL_TAGS).toContain('edits-anchors');
    expect(ALL_TAGS).toContain('edits-text');
    expect(ALL_TAGS).toContain('transforms-selection');
    expect(ALL_TAGS).toContain('samples-color');
    expect(ALL_TAGS).toContain('applies-fill');
    expect(ALL_TAGS).toContain('edits-page');
  });

  it('IMPLICIT_TAGS contains navigation only', () => {
    expect(IMPLICIT_TAGS).toEqual(['navigation']);
  });

  it('isCapabilityTag narrows correctly', () => {
    expect(isCapabilityTag('selection')).toBe(true);
    expect(isCapabilityTag('not-a-tag')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run packages/modes/src/capabilities.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `packages/modes/src/capabilities.ts`**

```ts
/** The full vocabulary of capability tags shipped in the default preset.
 *  Apps and other consumers can add their own tags; this list is what
 *  `weasel-modes` itself uses. */
export const ALL_TAGS = [
  'navigation',
  'selection',
  'creates-paths',
  'creates-shapes',
  'creates-text',
  'edits-anchors',
  'edits-text',
  'transforms-selection',
  'samples-color',
  'applies-fill',
  'edits-page',
] as const;

export type CapabilityTag = (typeof ALL_TAGS)[number] | (string & {});

/** Tags that are implicitly allowed in every mode — never listed per-mode.
 *  A tool tagged with any of these is always eligible. */
export const IMPLICIT_TAGS: readonly CapabilityTag[] = ['navigation'];

export function isCapabilityTag(value: string): value is CapabilityTag {
  return (ALL_TAGS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/modes/src/capabilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-export from index**

In `packages/modes/src/index.ts`:
```ts
export { ALL_TAGS, IMPLICIT_TAGS, isCapabilityTag } from './capabilities';
export type { CapabilityTag } from './capabilities';
```

- [ ] **Step 6: Commit**

```bash
git add packages/modes/src
git commit -m "feat(weasel-modes): capability tag vocabulary and implicit tags"
```

### Task 15: Define the `ModeDefinition` interface

**Files:**
- Create: `packages/modes/src/modeDefinition.ts`
- Modify: `packages/modes/src/index.ts`
- Test: `packages/modes/src/modeDefinition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/modes/src/modeDefinition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eligibleForMode } from './modeDefinition';
import type { ModeDefinition } from './modeDefinition';

const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
};

describe('eligibleForMode', () => {
  it('allows tools with any of the mode\'s declared tags', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors'])).toBe(true);
  });

  it('always allows navigation (implicit tag)', () => {
    expect(eligibleForMode(PATH_EDIT, ['navigation'])).toBe(true);
  });

  it('rejects tools whose tags are neither declared nor implicit', () => {
    expect(eligibleForMode(PATH_EDIT, ['creates-paths'])).toBe(false);
  });

  it('a tool with multiple tags is eligible if any tag is allowed', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors', 'creates-paths'])).toBe(true);
  });

  it('a tool with no tags is not eligible', () => {
    expect(eligibleForMode(PATH_EDIT, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run packages/modes/src/modeDefinition.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `packages/modes/src/modeDefinition.ts`**

```ts
import { IMPLICIT_TAGS, type CapabilityTag } from './capabilities';

export interface WorkspaceVisual {
  tint?: string;
  gradient?: 'top-down' | 'bottom-up';
  intensity?: number;
}

export interface ModeDefinition {
  id: string;
  kind: 'soft' | 'strict';
  /** Capability tags this mode allows beyond IMPLICIT_TAGS. */
  allows: CapabilityTag[];
  /** When true, out-of-target objects dim at the renderer layer. */
  scoping: boolean;
  workspace?: WorkspaceVisual;
  entry?: { shortcut?: string; trigger?: 'double-click-target' };
  exit?: { shortcut?: string };
  commit?: { shortcut?: string };
  cancel?: { shortcut?: string };
}

/** True iff a tool carrying `toolTags` is eligible for `mode`. */
export function eligibleForMode(mode: ModeDefinition, toolTags: readonly CapabilityTag[]): boolean {
  if (toolTags.length === 0) return false;
  const allowed = new Set<CapabilityTag>([...mode.allows, ...IMPLICIT_TAGS]);
  for (const t of toolTags) {
    if (allowed.has(t)) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/modes/src/modeDefinition.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-export from index**

In `packages/modes/src/index.ts`, append:
```ts
export { eligibleForMode } from './modeDefinition';
export type { ModeDefinition, WorkspaceVisual } from './modeDefinition';
```

- [ ] **Step 6: Commit**

```bash
git add packages/modes/src
git commit -m "feat(weasel-modes): ModeDefinition + eligibleForMode predicate"
```

### Task 16: Define the stock-mode preset (data only)

**Files:**
- Create: `packages/modes/src/presets/default.ts`
- Modify: `packages/modes/src/index.ts`
- Test: `packages/modes/src/presets/default.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/modes/src/presets/default.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_MODES, byId } from './default';

describe('default mode preset', () => {
  it('ships exactly six stock modes', () => {
    expect(DEFAULT_MODES.length).toBe(6);
  });

  it('includes the six documented mode ids', () => {
    const ids = DEFAULT_MODES.map((m) => m.id).sort();
    expect(ids).toEqual(['crop', 'free-transform', 'isolation', 'normal', 'path-edit', 'text-edit']);
  });

  it('path-edit is soft, scoping, blue', () => {
    const m = byId('path-edit');
    expect(m.kind).toBe('soft');
    expect(m.scoping).toBe(true);
    expect(m.workspace?.tint).toBe('#3b82f6');
    expect(m.allows).toContain('edits-anchors');
  });

  it('free-transform is strict, non-scoping, amber, with commit/cancel shortcuts', () => {
    const m = byId('free-transform');
    expect(m.kind).toBe('strict');
    expect(m.scoping).toBe(false);
    expect(m.workspace?.tint).toBe('#f59e0b');
    expect(m.commit?.shortcut).toBeDefined();
    expect(m.cancel?.shortcut).toBeDefined();
  });

  it('normal has no workspace tint', () => {
    const m = byId('normal');
    expect(m.workspace).toBeUndefined();
  });

  it('byId throws for unknown id', () => {
    expect(() => byId('nope')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run packages/modes/src/presets/default.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `packages/modes/src/presets/default.ts`**

```ts
import type { ModeDefinition } from '../modeDefinition';

export const NORMAL: ModeDefinition = {
  id: 'normal',
  kind: 'soft',
  allows: [
    'selection',
    'creates-paths',
    'creates-shapes',
    'creates-text',
    'samples-color',
    'applies-fill',
    'edits-page',
  ],
  scoping: false,
};

export const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target', shortcut: 'Enter' },
  exit: { shortcut: 'Escape' },
};

export const ISOLATION: ModeDefinition = {
  id: 'isolation',
  kind: 'soft',
  allows: [
    'selection',
    'creates-paths',
    'creates-shapes',
    'creates-text',
    'samples-color',
    'applies-fill',
  ],
  scoping: true,
  workspace: { tint: '#8b5cf6', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target' },
  exit: { shortcut: 'Escape' },
};

export const FREE_TRANSFORM: ModeDefinition = {
  id: 'free-transform',
  kind: 'strict',
  allows: ['transforms-selection'],
  scoping: false,
  workspace: { tint: '#f59e0b', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'Meta+T' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

export const TEXT_EDIT: ModeDefinition = {
  id: 'text-edit',
  kind: 'soft',
  allows: ['edits-text'],
  scoping: false,
  workspace: { tint: '#10b981', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target' },
  exit: { shortcut: 'Escape' },
};

export const CROP: ModeDefinition = {
  id: 'crop',
  kind: 'strict',
  allows: ['edits-page'],
  scoping: false,
  workspace: { tint: '#ef4444', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'C' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

export const DEFAULT_MODES: readonly ModeDefinition[] = [
  NORMAL,
  PATH_EDIT,
  ISOLATION,
  FREE_TRANSFORM,
  TEXT_EDIT,
  CROP,
];

export function byId(id: string): ModeDefinition {
  const m = DEFAULT_MODES.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown mode id: ${id}`);
  return m;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/modes/src/presets/default.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-export from index**

In `packages/modes/src/index.ts`, append:
```ts
export { DEFAULT_MODES, byId, NORMAL, PATH_EDIT, ISOLATION, FREE_TRANSFORM, TEXT_EDIT, CROP } from './presets/default';
```

- [ ] **Step 6: Commit**

```bash
git add packages/modes/src
git commit -m "feat(weasel-modes): six-mode default preset (data only)"
```

### Task 17: Build the mode registry

A small state container — current mode, transitions, listeners. The registry does not interpret modes (eligibility, scoping, etc.) — it just tracks "which mode is active right now" and notifies subscribers.

**Files:**
- Create: `packages/modes/src/registry.ts`
- Modify: `packages/modes/src/index.ts`
- Test: `packages/modes/src/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/modes/src/registry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES, NORMAL, PATH_EDIT } from './presets/default';

describe('createModeRegistry', () => {
  it('starts with the supplied initial mode', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(r.current().id).toBe('normal');
  });

  it('setMode swaps the active mode and bumps version', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const v0 = r.getVersion();
    r.setMode('path-edit');
    expect(r.current().id).toBe('path-edit');
    expect(r.getVersion()).toBeGreaterThan(v0);
  });

  it('setMode notifies subscribers', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const listener = vi.fn();
    const unsubscribe = r.subscribe(listener);

    r.setMode('path-edit');
    expect(listener).toHaveBeenCalledTimes(1);

    r.setMode('path-edit');  // same mode — should NOT notify
    expect(listener).toHaveBeenCalledTimes(1);

    r.setMode('isolation');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    r.setMode('normal');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('setMode rejects unknown ids', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(() => r.setMode('not-a-mode')).toThrow();
  });

  it('byId returns the mode definition', () => {
    const r = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    expect(r.byId('path-edit')).toBe(PATH_EDIT);
    expect(r.byId('normal')).toBe(NORMAL);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run packages/modes/src/registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `packages/modes/src/registry.ts`**

```ts
import type { ModeDefinition } from './modeDefinition';

export interface CreateModeRegistryOptions {
  modes: readonly ModeDefinition[];
  initial: string;
}

export interface ModeRegistry {
  current(): ModeDefinition;
  setMode(id: string): void;
  byId(id: string): ModeDefinition;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

export function createModeRegistry(opts: CreateModeRegistryOptions): ModeRegistry {
  const byIdMap = new Map(opts.modes.map((m) => [m.id, m]));
  const initial = byIdMap.get(opts.initial);
  if (!initial) throw new Error(`Initial mode "${opts.initial}" not in modes list`);

  let active: ModeDefinition = initial;
  let version = 0;
  const listeners = new Set<() => void>();

  function bump(): void {
    version++;
    for (const l of listeners) l();
  }

  return {
    current: () => active,
    setMode(id: string): void {
      const next = byIdMap.get(id);
      if (!next) throw new Error(`Unknown mode id: ${id}`);
      if (next === active) return;
      active = next;
      bump();
    },
    byId(id: string): ModeDefinition {
      const m = byIdMap.get(id);
      if (!m) throw new Error(`Unknown mode id: ${id}`);
      return m;
    },
    getVersion: () => version,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run packages/modes/src/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-export from index**

In `packages/modes/src/index.ts`, append:
```ts
export { createModeRegistry } from './registry';
export type { ModeRegistry, CreateModeRegistryOptions } from './registry';
```

- [ ] **Step 6: Commit**

```bash
git add packages/modes/src
git commit -m "feat(weasel-modes): mode registry with active mode + subscribe"
```

---

## Phase 4: Mode-owned decoration layer

The decoration layer is a `RenderLayer<unknown>` whose contents come from the active mode (via the registry) rather than from any tool. It paints persistent affordances (anchor dots, isolation breadcrumb anchor lines, etc.) that should outlive any single tool's lifetime within a mode.

The shape: a function that, given the current `ModeDefinition` and the canvas context, returns `DrawCommand[]`. The decoration layer wires this into the existing layer-slot system used by `<Canvas>`.

### Task 18: Define the mode-decoration adapter interface

This task defines the *contract*. Modes register decoration painters by id; the layer looks up the painter for the active mode each frame.

**Files:**
- Create: `packages/modes/src/decorations.ts`
- Modify: `packages/modes/src/index.ts`
- Test: `packages/modes/src/decorations.test.ts`

- [ ] **Step 1: Read the existing RenderLayer shape**

Run: `cat src/core/layers/render.ts | head -60`
Read this to understand the shape decoration painters must produce.

(For plan-readability, the contract is roughly: a `RenderLayer<S>` has a `paint(ctx, state: S)` method returning draw commands, plus `id`, `dirty()`, and a `state` accessor.)

- [ ] **Step 2: Write the failing test**

Create `packages/modes/src/decorations.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createModeDecorations } from './decorations';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

describe('createModeDecorations', () => {
  it('returns no draw commands when no painter is registered for the active mode', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const cmds = d.paint();
    expect(cmds).toEqual([]);
  });

  it('returns painter output for the active mode', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const d = createModeDecorations({ registry });

    const painter = vi.fn().mockReturnValue([{ kind: 'path', d: 'M0 0', fill: '#000' } as never]);
    d.register('path-edit', painter);

    const cmds = d.paint();
    expect(painter).toHaveBeenCalledTimes(1);
    expect(cmds.length).toBe(1);
  });

  it('switching modes swaps which painter is invoked', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const pathEditPainter = vi.fn().mockReturnValue([]);
    const isolationPainter = vi.fn().mockReturnValue([]);
    d.register('path-edit', pathEditPainter);
    d.register('isolation', isolationPainter);

    registry.setMode('path-edit');
    d.paint();
    expect(pathEditPainter).toHaveBeenCalledTimes(1);
    expect(isolationPainter).not.toHaveBeenCalled();

    registry.setMode('isolation');
    d.paint();
    expect(isolationPainter).toHaveBeenCalledTimes(1);
  });

  it('version() bumps when the active mode changes', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const v0 = d.version();
    registry.setMode('path-edit');
    expect(d.version()).toBeGreaterThan(v0);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run packages/modes/src/decorations.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Create `packages/modes/src/decorations.ts`**

```ts
import type { ModeRegistry } from './registry';

/** Loose draw-command type — the kit's `DrawCommand` union shape is over in
 *  `src/renderer`. We keep this opaque to avoid a cross-package import in
 *  the type surface; consumers cast to the real DrawCommand at use site. */
export type ModeDrawCommand = unknown;

export type ModeDecorationPainter = () => ModeDrawCommand[];

export interface CreateModeDecorationsOptions {
  registry: ModeRegistry;
}

export interface ModeDecorations {
  /** Register (or replace) the painter for a mode id. */
  register(modeId: string, painter: ModeDecorationPainter): void;
  /** Paint the active mode's decorations. Returns an empty array if no
   *  painter is registered for the active mode. */
  paint(): ModeDrawCommand[];
  /** Monotonic version. Bumps on mode change or painter registration. */
  version(): number;
}

export function createModeDecorations(opts: CreateModeDecorationsOptions): ModeDecorations {
  const { registry } = opts;
  const painters = new Map<string, ModeDecorationPainter>();
  let version = 0;

  registry.subscribe(() => {
    version++;
  });

  return {
    register(modeId: string, painter: ModeDecorationPainter): void {
      painters.set(modeId, painter);
      version++;
    },
    paint(): ModeDrawCommand[] {
      const painter = painters.get(registry.current().id);
      if (!painter) return [];
      return painter();
    },
    version: () => version,
  };
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/modes/src/decorations.test.ts`
Expected: PASS.

- [ ] **Step 6: Re-export from index**

In `packages/modes/src/index.ts`, append:
```ts
export { createModeDecorations } from './decorations';
export type { ModeDecorations, ModeDecorationPainter, CreateModeDecorationsOptions, ModeDrawCommand } from './decorations';
```

- [ ] **Step 7: Commit**

```bash
git add packages/modes/src
git commit -m "feat(weasel-modes): mode-owned decoration layer (painter registry)"
```

### Task 19: Final integration — confirm the whole repo builds and tests pass

**Files:**
- (no edits expected; this is a verification task)

- [ ] **Step 1: Run typecheck across the entire repo**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 3: Run the prepublish gate (matches CI)**

Run: `npm run prepublishOnly`
Expected: PASS — `tsc --noEmit && vitest run && tsup build` all green.

If `prepublishOnly` does not exist at the root, check `package.json` scripts; otherwise run the equivalent: `npx tsc --noEmit && npx vitest run`.

- [ ] **Step 4: Verify the two new packages are visible from a kit-internal import path**

Run: `node -e "import('@weasel-js/history').then((m) => console.log(Object.keys(m)))"`
Expected: list including `createHistory`. (Note: `beginJournal` and `resumeJournal` are methods on the `History` instance, not module-level exports.)

Run: `node -e "import('@weasel-js/modes').then((m) => console.log(Object.keys(m)))"`
Expected: list including `createModeRegistry`, `DEFAULT_MODES`, `eligibleForMode`, `createModeDecorations`, `ALL_TAGS`.

- [ ] **Step 5: No-op commit (or skip if everything was committed in prior tasks)**

If anything was left uncommitted (e.g., `node_modules` lock changes), commit it:
```bash
git status
# if anything stage-able:
git add <files>
git commit -m "chore: tidy up after modality kit foundations"
```

---

## Self-review (run before handoff)

After completing all tasks, do a final spec-coverage pass:

- [ ] **Spec coverage check.** Open `docs/superpowers/specs/2026-05-24-modality-design.md`. For each section, confirm the kit-side responsibilities are implemented:
  - `Journal` API: `applyBatch`, `undo`, `redo`, `canUndo`, `canRedo`, `entries`, `commit`, `cancel`, `suspend` — ✓ Tasks 6-12
  - `history.beginJournal` + `history.resumeJournal` — ✓ Tasks 6, 11
  - `History.recordEntry` for preapplied push — ✓ Task 4
  - `History.allForwardOps` / `currentEntryId` — ✓ Tasks 5, 12
  - `weasel-modes` package with capability tags, mode definitions, registry, decoration layer — ✓ Tasks 13-18
  - Six stock-mode preset — ✓ Task 16
  - Forward-compatible `eligibleForMode` predicate with `IMPLICIT_TAGS` baked in — ✓ Task 15
- [ ] **Type consistency check.** Verify method names match across all task code blocks: `applyBatch`, `commit`, `cancel`, `suspend`, `recordEntry`, `allForwardOps`, `currentEntryId`, `forkedAtEntryId`, `eligibleForMode`, `createModeDecorations`, `register`, `paint`.
- [ ] **No placeholders.** Every test in every task has actual assertions; every implementation has real code.

## Out of scope (handled in subsequent plans)

- WeaselDraw mode machine, journal cache, chrome (Plan 2).
- Wiring path-edit end-to-end (Plan 2).
- The remaining five modes' end-to-end implementations (Plan 3+).
- The "routing of applyOps through the active journal" — this is a canvas/context-layer concern, not a kit-internal change; it lives in Plan 2 because it touches WeaselDraw's ctx wiring.
