# Unify `useScene` History onto `@weasel-js/history` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `createScene`'s private `LogEntry` undo/redo stacks with a `@weasel-js/history` instance, preserving all current behavior, and add opt-in coalescing via a new `UseSceneOptions.coalesceWindowMs`.

**Architecture:** The scene's `RegisteredOp` registry stays as the state-mutation layer; a `makeOp` wrapper bridges `(kind, payload)` pairs into engine `Op`s whose `invert()` flips apply↔revert. The engine gains two small additive options (`historyLimit`, `onEvict`) so the scene's stack cap and `pendingClipPatches` pruning move onto engine hooks. The `applyBatch` non-journal fork collapses onto `history.applyOps` with ops rebound to the call-site adapter; a `suppressRecording` flag (generalizing today's `replaying`) blocks double-recording whenever the engine drives mutations.

**Tech Stack:** TypeScript, vitest (projects: `weasel-ui` for `packages/history`, `kit` for `src/core/scene`), tsup.

**Spec:** `docs/superpowers/specs/2026-07-25-unify-scene-history-engine-design.md` (approved, Phase 1 scope). Phase 2 (serialization/persistence) is OUT OF SCOPE.

**Resolved open questions** (from the spec):
1. Coalesce key for id-less ops → **omit** the key (never coalesces).
2. `recordEntry` does **not** coalesce (confirmed in `history.ts`) → `scene.batch` entries are always discrete. Fine — an explicit batch is already one entry. A test documents this.
3. Journal seam → the journal branch of `applyBatch` is unchanged (still routes to `journal.applyBatch` with scene recording suppressed). Gated by `src/canvas/sceneAdapter.journal.test.ts` and the draw modality suites.
4. Notify bridging → **explicit `notify()` per public call**, never `history.subscribe(...)`. Subscribe-based would double-fire on batch flush (`recordEntry` bumps the engine after the batch's own dirty-flush).

**Key risk the spec glossed over (handled in Task 4):** the collapsed non-journal `applyBatch` cannot pass external ops straight to `history.applyOps` — the engine applies ops with its construction-time adapter (the scene has none), and external ops' `apply(adapter)` re-enters scene mutation methods (`adapter.setNodePose` → `scene.setPose` → `executeAndLog`), which would re-record. Fix: rebind each op to the call-site adapter (`bindOpToAdapter`) and wrap every engine-driven walk (`undo`/`redo`/`goto`/`applyBatch`) in `withRecordingSuppressed`.

**Files:**
- Modify: `packages/history/src/history.ts` — `historyLimit`, `onEvict` options
- Modify: `packages/history/src/index.ts` — export `EvictedEntry`
- Create: `packages/history/src/history.limit.test.ts`
- Modify: `src/core/scene/scene.ts` — engine swap
- Modify: `src/core/scene/types.ts` — `coalesceWindowMs` option
- Modify: `src/core/scene/scene.test.ts` — new `applyBatch` + coalescing tests
- Modify: `docs/TODO.md` — mark the P2 item done, note Phase 2 follow-up

---

### Task 0: Workspace setup

- [ ] **Step 1: Create an isolated worktree** (per superpowers:using-git-worktrees) on a new branch `unify-scene-history` cut from `main`. All subsequent file paths are relative to that worktree root; subagent prompts must use worktree-absolute paths.

- [ ] **Step 2: Install and baseline**

Run (from the worktree root):
```bash
npm install
npm run typecheck && npx vitest run --project=weasel-ui packages/history && npx vitest run --project=kit src/core/scene
```
Expected: clean typecheck, all history-package and scene tests PASS. Do not proceed on a dirty baseline.

---

### Task 1: Engine — `historyLimit` option

**Files:**
- Modify: `packages/history/src/history.ts`
- Create: `packages/history/src/history.limit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/history/src/history.limit.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

interface Cell { x: number }

/** Minimal invertible op over a shared cell. `key` opts into coalescing. */
function setX(cell: Cell, from: number, to: number, key?: string): Op {
  return {
    name: 'test:setX',
    args: { id: 'a', from, to },
    coalesceKey: key,
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from, key),
  };
}

describe('historyLimit', () => {
  it('evicts the oldest entry when a push overflows the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 2 });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.applyOps([setX(cell, 2, 3)], 'three');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two', 'three']);
    history.undo();
    history.undo();
    expect(history.canUndo()).toBe(false);
    // The evicted 'one' can no longer be undone: state rests at its to-state.
    expect(cell.x).toBe(1);
  });

  it('recordEntry also enforces the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 1 });
    history.recordEntry([setX(cell, 0, 1)], 'one');
    history.recordEntry([setX(cell, 1, 2)], 'two');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two']);
  });

  it('coalescing does not evict (stack depth unchanged)', () => {
    const cell: Cell = { x: 0 };
    let t = 1000;
    const onEvict = vi.fn();
    const history = createHistory(null, {
      historyLimit: 2, coalesceWindowMs: 500, now: () => t, onEvict,
    });
    history.applyOps([setX(cell, 0, 1, 'x')], 'drag');
    t += 100;
    history.applyOps([setX(cell, 1, 2, 'x')], 'drag'); // merges
    t += 100;
    history.applyOps([setX(cell, 2, 3, 'x')], 'drag'); // merges
    expect(history.entries().undo).toHaveLength(1);
    expect(onEvict).not.toHaveBeenCalled();
  });
});
```

(The third test references `onEvict`, added in Task 2 — TypeScript will reject the option until then. Comment out the `onEvict` lines of that one test for this task and restore them in Task 2, or accept both tests failing until Task 2; the executor should comment them out so Task 1 lands green.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=weasel-ui packages/history/src/history.limit.test.ts`
Expected: FAIL — `historyLimit` is not a known option / entries are not evicted (undo stack has 3 entries).

- [ ] **Step 3: Implement `historyLimit`**

In `packages/history/src/history.ts`:

3a. Add to `CreateHistoryOptions` (after the `now` member):

```ts
  /** Maximum undo-stack depth. When a push overflows the cap the oldest
   *  entry is evicted (reported via `onEvict`) and can no longer be undone.
   *  Default: unbounded. */
  historyLimit?: number;
```

3b. In `createHistory`, next to the existing option reads:

```ts
  const historyLimit = options.historyLimit ?? Infinity;
```

3c. Add a helper after `bump()`:

```ts
  /** Evict the oldest undo entries past `historyLimit`. */
  function enforceLimit(): void {
    while (undoStack.length > historyLimit) {
      undoStack.shift();
    }
  }
```

3d. In `pushOrCoalesce`, in the discrete-push branch, call `enforceLimit()` between the `undoStack.push(...)` line and `bump()` (after the `redoStack.length = 0;` line). In `recordEntry`, likewise call `enforceLimit()` after its `redoStack.length = 0;` line, before `bump()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=weasel-ui packages/history`
Expected: PASS (new limit tests + entire existing history/journal suite).

- [ ] **Step 5: Commit**

```bash
git add packages/history/src/history.ts packages/history/src/history.limit.test.ts
git commit -m "feat(history): add historyLimit option capping the undo stack"
```

---

### Task 2: Engine — `onEvict` callback

**Files:**
- Modify: `packages/history/src/history.ts`
- Modify: `packages/history/src/index.ts`
- Modify: `packages/history/src/history.limit.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/history/src/history.limit.test.ts` (and restore any `onEvict` lines commented out in Task 1):

```ts
describe('onEvict', () => {
  it('fires with the evicted entry on historyLimit overflow', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { historyLimit: 1, onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    expect(onEvict).toHaveBeenCalledTimes(1);
    const entry = onEvict.mock.calls[0][0];
    expect(entry.label).toBe('one');
    expect(entry.forwardOps[0].name).toBe('test:setX');
  });

  it('fires for each redo entry dropped by a branch edit', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.applyOps([setX(cell, 2, 3)], 'three');
    history.undo();
    history.undo(); // redo stack now holds 'two' and 'three'
    history.applyOps([setX(cell, 1, 9)], 'branch');
    expect(onEvict).toHaveBeenCalledTimes(2);
    const labels = onEvict.mock.calls.map((c) => c[0].label).sort();
    expect(labels).toEqual(['three', 'two']);
  });

  it('fires on the coalesce path when the merge clears the redo stack', () => {
    const cell: Cell = { x: 0 };
    let t = 1000;
    const onEvict = vi.fn();
    const history = createHistory(null, { coalesceWindowMs: 500, now: () => t, onEvict });
    history.applyOps([setX(cell, 0, 1, 'x')], 'drag');
    history.applyOps([setX(cell, 1, 2)], 'other'); // no key — discrete
    history.undo();                                // redo: ['other']
    t += 100;
    history.applyOps([setX(cell, 1, 3, 'x')], 'drag'); // coalesces into 'drag'
    expect(history.entries().undo.map((e) => e.label)).toEqual(['drag']);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict.mock.calls[0][0].label).toBe('other');
  });

  it('fires on recordEntry redo-clear and recordEntry overflow', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { historyLimit: 1, onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.undo();                                 // redo: ['one']
    history.recordEntry([setX(cell, 0, 2)], 'rec'); // drops 'one' from redo
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict.mock.calls[0][0].label).toBe('one');
    history.recordEntry([setX(cell, 2, 3)], 'rec2'); // overflow → evicts 'rec'
    expect(onEvict).toHaveBeenCalledTimes(2);
    expect(onEvict.mock.calls[1][0].label).toBe('rec');
  });

  it('does NOT fire on clear() or restore()', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    const snap = history.serialize();
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.restore(snap); // wholesale replace — no per-entry eviction
    history.applyOps([setX(cell, 1, 5)], 'three');
    history.clear();       // wholesale drop — no per-entry eviction
    expect(onEvict).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=weasel-ui packages/history/src/history.limit.test.ts`
Expected: FAIL — `onEvict` unknown option / spy never called.

- [ ] **Step 3: Implement `onEvict`**

In `packages/history/src/history.ts`:

3a. Add the exported type (near `HistoryEntry`):

```ts
/** Snapshot of an entry handed to `onEvict` when it permanently leaves the
 *  reachable stacks. Ops are live references — read `name`/`args`, don't
 *  mutate. */
export interface EvictedEntry {
  id: number;
  label: string;
  forwardOps: readonly Op[];
  baseOps: readonly Op[];
}
```

3b. Add to `CreateHistoryOptions` (after `historyLimit`):

```ts
  /** Fired once per entry that permanently leaves the reachable stacks:
   *  redo entries dropped by a branch edit (a new push / coalesce /
   *  `recordEntry` after undo) and undo entries evicted by `historyLimit`.
   *  NOT fired by `clear()` or `restore()` — those wholesale-replace the
   *  history and the caller already knows. */
  onEvict?: (entry: EvictedEntry) => void;
```

3c. In `createHistory`, read the option and add helpers (replacing Task 1's bare `enforceLimit`):

```ts
  const onEvict = options.onEvict;

  /** Report entries that just became permanently unreachable. */
  function reportEvicted(entries: Entry[]): void {
    if (!onEvict) return;
    for (const e of entries) {
      onEvict({ id: e.id, label: e.label, forwardOps: e.forwardOps, baseOps: e.baseOps });
    }
  }

  /** Clear the redo stack (branch-on-edit), reporting dropped entries. */
  function dropRedo(): void {
    if (redoStack.length === 0) return;
    reportEvicted(redoStack.splice(0));
  }

  /** Evict the oldest undo entries past `historyLimit`, reporting each. */
  function enforceLimit(): void {
    while (undoStack.length > historyLimit) {
      reportEvicted([undoStack.shift()!]);
    }
  }
```

3d. Replace every branch-edit `redoStack.length = 0;` with `dropRedo();` in exactly three places: the coalesce branch of `pushOrCoalesce`, the discrete-push branch of `pushOrCoalesce`, and `recordEntry`. Do NOT touch the `redoStack.length = 0` assignments inside `clear()` and `restore()` — those intentionally bypass `onEvict`.

- [ ] **Step 4: Export the type**

In `packages/history/src/index.ts`, add `EvictedEntry` to the type re-exports from `'./history'`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project=weasel-ui packages/history`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add packages/history/src/history.ts packages/history/src/index.ts packages/history/src/history.limit.test.ts
git commit -m "feat(history): add onEvict callback for branch-edit and limit evictions"
```

---

### Task 3: Scene — swap the engine (behavior-preserving)

The regression gate for this task is the **existing, unmodified** `src/core/scene/scene.test.ts` suite. No new tests are written here; the whole point is that the swap is invisible.

**Files:**
- Modify: `src/core/scene/scene.ts`

- [ ] **Step 1: Rewrite the history internals of `scene.ts`**

Apply the following edits (all inside `src/core/scene/scene.ts`).

**Edit A — imports** (top of file). Replace:

```ts
import type { Journal } from '@weasel-js/history';
```

with:

```ts
import { createHistory, type Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
```

**Edit B — delete the `LogEntry` machinery.** Remove the `LogEntry` interface, `logEntryCounter`, and `nextLogEntryId()` (currently lines 20–29).

**Edit C — state block.** Replace this block (currently around lines 103–115):

```ts
  const generateId = options.generateId ?? defaultGenerateId;
  const historyLimit = options.historyLimit ?? Infinity;

  const undoStack: LogEntry[] = [];
  const redoStack: LogEntry[] = [];
  const listeners = new Set<() => void>();
  const registered = new Map<string, RegisteredOp<unknown>>();

  let version = 0;
  let batchDepth = 0;
  let currentBatch: LogEntry | null = null;
  /** True while inside undo/redo replay — suppresses log writes. */
  let replaying = false;
```

with:

```ts
  const generateId = options.generateId ?? defaultGenerateId;

  const listeners = new Set<() => void>();
  const registered = new Map<string, RegisteredOp<unknown>>();

  // The scene's undo/redo engine. Recorded ops are `makeOp` wrappers over
  // `registered` handlers, so the engine's adapter argument is unused (the
  // wrappers close over their payloads). Eviction (branch-edit redo-clears
  // + historyLimit overflow) drives pendingClipPatches pruning via onEvict.
  const history = createHistory(undefined, {
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    onEvict: (entry) => {
      pruneCacheForDroppedOps(entry.forwardOps);
      pruneCacheForDroppedOps(entry.baseOps);
    },
  });

  let version = 0;
  let batchDepth = 0;
  let currentBatch: { label: string; ops: Op[] } | null = null;
  /** True while the history engine drives mutations (undo/redo/goto, journal
   *  routing) — suppresses scene-side history recording so engine-applied
   *  ops that re-enter scene mutation methods don't record twice. */
  let suppressRecording = false;
```

**Edit D — prune helper.** Replace `pruneCacheForDroppedEntries` (and its doc comment) with:

```ts
  /**
   * Prune `pendingClipPatches` entries for nodes referenced only by ops in
   * entries that just became permanently unreachable (redo entries dropped
   * by a branch edit, or undo entries evicted by `historyLimit`) — wired to
   * the engine's `onEvict`. An entry is safe to drop when the node is absent
   * from `state.nodes`: its only path back into the scene was through these
   * now-unreachable ops.
   */
  function pruneCacheForDroppedOps(ops: readonly Op[]): void {
    if (pendingClipPatches.size === 0) return;
    for (const op of ops) {
      if (op.name !== 'kit:add') continue;
      const id = (op.args as { id?: NodeId } | null)?.id;
      if (id && !state.nodes.has(id) && pendingClipPatches.has(id)) {
        pendingClipPatches.delete(id);
      }
    }
  }
```

Also update the `pendingClipPatches` doc comment's two numbered hook points (currently referencing `redoStack` clears and `historyLimit` eviction in `pushEntry`) to say the pruning now hangs off the engine's `onEvict` callback; the invariant sentence stays.

**Edit E — delete `pushEntry` entirely.**

**Edit F — the op bridge.** Immediately after `runOp` (keep `runOp` as-is), replace `executeAndLog` and add the new helpers:

```ts
  /** Bridge a registered scene op into an engine `Op`: a direction-flipping
   *  wrapper over the `RegisteredOp`'s `apply`/`revert` pair. `invert()`
   *  flips the direction with the same payload, so undo replays `revert`
   *  and redo replays `apply` — no per-op inverse code. `name`/`args` carry
   *  the (kind, payload) pair for eviction pruning (and, later,
   *  serialization). Handler lookup happens at apply time so re-registered
   *  kinds take effect on replay, but existence is checked eagerly to fail
   *  fast at the call site. */
  function makeOp(kind: string, payload: unknown, dir: 'fwd' | 'rev' = 'fwd'): Op {
    if (!registered.has(kind)) {
      throw new Error(`Scene: no registered op for kind "${kind}"`);
    }
    return {
      name: kind,
      args: payload,
      coalesceKey: coalesceKeyFor(kind, payload),
      apply: () => {
        const handler = registered.get(kind);
        if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
        (dir === 'fwd' ? handler.apply : handler.revert)(payload);
      },
      invert: () => makeOp(kind, payload, dir === 'fwd' ? 'rev' : 'fwd'),
    };
  }

  /** Best-effort coalesce-grouping token: node ops carry `payload.id`,
   *  layer ops `payload.layer`. Payloads with neither get no key and never
   *  coalesce (the engine treats a missing key on either side as
   *  "new entry"). */
  function coalesceKeyFor(kind: string, payload: unknown): string | undefined {
    if (payload === null || typeof payload !== 'object') return undefined;
    const p = payload as { id?: unknown; layer?: unknown };
    const token =
      typeof p.id === 'string' ? p.id
      : typeof p.layer === 'string' ? p.layer
      : undefined;
    return token === undefined ? undefined : `${kind}:${token}`;
  }

  /** Run `fn` with scene-side recording suppressed and per-op notifies
   *  batched. Used whenever the engine drives mutations (undo/redo/goto):
   *  engine-applied ops may re-enter scene mutation methods, which must
   *  apply but not record. The caller fires exactly one `notify()` after. */
  function withRecordingSuppressed<T>(fn: () => T): T {
    suppressRecording = true;
    batchDepth++;
    const prevDirty = batchDirty;
    try {
      return fn();
    } finally {
      batchDepth--;
      suppressRecording = false;
      batchDirty = prevDirty;
    }
  }

  function executeAndLog(kind: string, payload: unknown, label: string): void {
    if (suppressRecording) {
      runOp(kind, payload);
      notify();
      return;
    }
    if (currentBatch) {
      runOp(kind, payload);
      currentBatch.ops.push(makeOp(kind, payload));
      notify();
      return;
    }
    // The engine applies the op itself (inside applyOps) — no separate
    // runOp call, or the mutation would run twice.
    history.applyOps([makeOp(kind, payload)], label);
    notify();
  }
```

**Edit G — `applyBatch`.** Only rename the flag in the journal branch (`replaying = true/false` → `suppressRecording = true/false`) and update the comment sentence that says "We reuse the `replaying` flag…" to reference `suppressRecording`. The `else` branch (`scene.batch(...)`) stays exactly as-is in this task — it now flushes through `history.recordEntry` via the new `batch` below, which is behavior-equivalent. Task 4 collapses it.

**Edit H — `undo` / `redo` / `canUndo` / `canRedo`.** Replace the four members with:

```ts
    undo() {
      if (!history.canUndo()) return false;
      withRecordingSuppressed(() => history.undo());
      notify();
      return true;
    },

    redo() {
      if (!history.canRedo()) return false;
      withRecordingSuppressed(() => history.redo());
      notify();
      return true;
    },

    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
```

**Edit I — history views.** Replace `historyEntries`, `historyIndex`, and `jumpToHistoryIndex` bodies (keep their existing doc comments):

```ts
    historyEntries() {
      const { undo, redo } = history.entries();
      const out: { id: string; label: string }[] = [];
      for (const e of undo) out.push({ id: String(e.id), label: e.label });
      // entries().redo is already chronological: the next redo comes first.
      for (const e of redo) out.push({ id: String(e.id), label: e.label });
      return out;
    },

    historyIndex: () => history.entries().undo.length,

    jumpToHistoryIndex(targetIndex: number) {
      const { undo, redo } = history.entries();
      const total = undo.length + redo.length;
      const target = Math.max(0, Math.min(total, targetIndex));
      if (target === undo.length) return false;
      withRecordingSuppressed(() => history.goto(target));
      notify();
      return true;
    },
```

(Note: entry ids change from `"h1"`-style to `"1"`-style strings. The only consumer keys React lists on them — `apps/draw` `HistoryList`, whose synthetic `'__initial__'` row can't collide. The public contract is "stable string id", which holds: engine ids survive coalescing.)

**Edit J — `batch`.** Replace the member with:

```ts
    batch(label, fn) {
      if (batchDepth === 0) currentBatch = { label, ops: [] };
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          if (currentBatch) {
            const finished = currentBatch;
            currentBatch = null;
            // Ops were applied live as they were issued (state stays
            // readable mid-batch); recordEntry pushes without re-applying.
            if (finished.ops.length > 0) {
              history.recordEntry(finished.ops, finished.label);
            }
          }
          // Fire one coalesced notify if any op inside the batch dirtied
          // state. Nested batches contribute to the same flush — only the
          // outermost emits.
          if (batchDirty) {
            batchDirty = false;
            for (const listener of listeners) listener();
          }
        }
      }
    },
```

**Edit K — `loadState`.** Replace the two lines `undoStack.length = 0;` / `redoStack.length = 0;` with `history.clear();` (the surrounding "Clear history + transient batch/clip caches" comment stays; `pendingClipPatches.clear()` etc. are untouched — `clear()` deliberately does not fire `onEvict`).

- [ ] **Step 2: Check for stragglers**

Run: `grep -n "LogEntry\|pushEntry\|replaying\|undoStack\|redoStack\|nextLogEntryId\|historyLimit" src/core/scene/scene.ts`
Expected: no hits except the `options.historyLimit` pass-through in the `createHistory` call. Also confirm nothing else in the repo referenced the internals: `grep -rn "LogEntry" src apps packages --include="*.ts" --include="*.tsx"` → no hits outside this file's history (the interface was module-private).

- [ ] **Step 3: Run the regression gate**

Run: `npx vitest run --project=kit src/core/scene`
Expected: PASS — the entire existing `scene.test.ts`, `useScene.test.ts`, `NodeProperties.test.ts`, `NodeRouting.test.ts` suites, **unmodified**. Debug failures here before moving on; every failure is a behavior change the spec forbids.

- [ ] **Step 4: Run the wider suite**

Run: `npm run typecheck && npm test`
Expected: PASS (scene is widely consumed — sceneAdapter, actions, draw modality suites all gate the swap).

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/scene.ts
git commit -m "refactor(scene): delegate undo/redo to the @weasel-js/history engine"
```

---

### Task 4: Collapse the `applyBatch` non-journal fork

**Files:**
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/core/scene/scene.test.ts`, add `import type { Op } from 'core/ops/types';` to the imports (type-only — erased at runtime, so vitest resolution is unaffected), then append:

```ts
describe('applyBatch (no journal)', () => {
  it('records one entry; undo replays inverted ops, redo replays forward ops', () => {
    const s = makeScene();
    const cell = { x: 0 };
    const mk = (from: number, to: number): Op => ({
      apply: () => { cell.x = to; },
      invert: () => mk(to, from),
    });
    s.applyBatch([mk(0, 5)], 'set x', null);
    expect(cell.x).toBe(5);
    expect(s.historyEntries()).toHaveLength(1);
    expect(s.undo()).toBe(true);
    expect(cell.x).toBe(0);
    s.redo();
    expect(cell.x).toBe(5);
  });

  it('ops are applied against the adapter passed at the call site', () => {
    const s = makeScene();
    const seen: unknown[] = [];
    const op: Op = {
      apply: (adapter) => { seen.push(adapter); },
      invert: () => op,
    };
    const adapter = { marker: true };
    s.applyBatch([op], 'probe', adapter);
    expect(seen).toEqual([adapter]);
  });

  it('ops that re-enter scene mutation methods do not double-record', () => {
    const s = makeScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    const mk = (from: typeof POSE, to: typeof POSE): Op => ({
      apply: (adapter) => { (adapter as typeof s).setPose(id, to); },
      invert: () => mk(to, from),
    });
    // The op mutates via the "adapter" (here: the scene itself, standing in
    // for a SceneCanvasAdapter that forwards to scene.setPose).
    s.applyBatch([mk(POSE, P2)], 'move', s);
    // Exactly two entries: the add and the applyBatch — the inner setPose
    // must not have recorded a third.
    expect(s.historyEntries()).toHaveLength(2);
    expect(s.get(id)?.pose).toEqual(P2);
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual(P2);
  });

  it('all-noop batches push no entry', () => {
    const s = makeScene();
    const op: Op = {
      apply: () => 'noop' as const,
      invert: () => op,
    };
    s.applyBatch([op], 'nothing', null);
    expect(s.canUndo()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify current state**

Run: `npx vitest run --project=kit src/core/scene/scene.test.ts`
Expected: all four new tests PASS **already** — the pre-collapse `scene.batch` route satisfies the same contract. That is intentional: this refactor is behavior-preserving, so these are *pinning* tests (they must stay green through Step 3), not red-first TDD tests. The observable payoff of the collapse — coalescing across `applyBatch` calls — gets its red-first test in Task 5 (`applyBatch entries coalesce on matching key multisets`), which cannot pass on the `scene.batch` route (batch flushes via `recordEntry`, which never coalesces).

- [ ] **Step 3: Implement the collapse**

In `src/core/scene/scene.ts`:

3a. Add next to `makeOp`:

```ts
  /** Rebind an external op to the adapter supplied at the `applyBatch` call
   *  site — the scene's engine was constructed without an adapter, so ops
   *  it stores and later replays must close over the right one. Forwards
   *  the apply return value (no-op detection) and preserves
   *  `coalesceKey`/`name`/`args`/`label` for coalescing and eviction. */
  function bindOpToAdapter(op: Op, adapter: unknown): Op {
    return {
      name: op.name,
      args: op.args,
      label: op.label,
      coalesceKey: op.coalesceKey,
      apply: () => op.apply(adapter),
      invert: () => bindOpToAdapter(op.invert(), adapter),
    };
  }
```

3b. Replace the whole `applyBatch` member with:

```ts
    applyBatch(ops, label, adapter) {
      const journal: Journal | null = (activeJournalAccessor ?? (() => null))();
      // Either route drives mutations from a history engine (the journal's
      // inner history, or the scene's own), so scene-side recording is
      // suppressed for the duration: op applies that re-enter scene
      // mutation methods via the adapter must mutate without re-recording.
      // batchDepth coalesces the per-op notify() calls (same as
      // scene.batch); exactly one listener dispatch fires at the end.
      suppressRecording = true;
      batchDepth++;
      batchDirty = false;
      try {
        if (journal) {
          journal.applyBatch(ops, label);
        } else {
          // Native path: record the external ops themselves as one engine
          // entry — coalescible across applyBatch calls via their own
          // coalesceKeys — rebound to this call's adapter.
          history.applyOps(ops.map((op) => bindOpToAdapter(op, adapter)), label);
        }
      } finally {
        batchDepth--;
        suppressRecording = false;
      }
      if (batchDirty) {
        batchDirty = false;
        for (const listener of listeners) listener();
      }
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=kit src/core/scene`
Expected: PASS, including all four new tests.

- [ ] **Step 5: Run the journal + actions gates**

Run: `npm test`
Expected: PASS — pay particular attention to `src/canvas/sceneAdapter.journal.test.ts`, `src/interactions/actions/**` (nudge, move, resize, flip, clone, delete, reorder all commit through `applyBatch`), and `apps/draw/src/modality/**`.

- [ ] **Step 6: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "refactor(scene): route non-journal applyBatch through the history engine"
```

---

### Task 5: Opt-in coalescing — `coalesceWindowMs`

**Files:**
- Modify: `src/core/scene/types.ts`
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/core/scene/scene.test.ts`, extend the vitest import to include `beforeEach` and `afterEach`, then append:

```ts
describe('coalescing (coalesceWindowMs)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function timedScene() {
    return createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
      coalesceWindowMs: 500,
    });
  }

  it('rapid setPose on one node merges into a single entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length; // the add
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 3, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 1);
    expect(s.get(id)?.pose).toEqual({ x: 3, y: 0, width: 10, height: 10 });
  });

  it('undo of a coalesced entry returns to the pre-burst state; redo to the final', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(100);
    s.setPose(id, { x: 5, y: 0, width: 10, height: 10 });
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual({ x: 5, y: 0, width: 10, height: 10 });
  });

  it('a gap larger than the window starts a new entry', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.setPose(id, { x: 1, y: 0, width: 10, height: 10 });
    vi.advanceTimersByTime(600); // outside the 500ms window
    s.setPose(id, { x: 2, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
    s.undo();
    expect(s.get(id)?.pose).toEqual({ x: 1, y: 0, width: 10, height: 10 });
  });

  it('mutations on different nodes never merge', () => {
    const s = timedScene();
    const a = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const before = s.historyEntries().length;
    s.setPose(a, { x: 1, y: 0, width: 10, height: 10 });
    s.setPose(b, { x: 1, y: 0, width: 10, height: 10 });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('scene.batch entries are always discrete (recordEntry never coalesces)', () => {
    const s = timedScene();
    const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const before = s.historyEntries().length;
    s.batch('drag', () => { s.setPose(id, { x: 1, y: 0, width: 10, height: 10 }); });
    vi.advanceTimersByTime(100);
    s.batch('drag', () => { s.setPose(id, { x: 2, y: 0, width: 10, height: 10 }); });
    expect(s.historyEntries().length).toBe(before + 2);
  });

  it('applyBatch entries coalesce on matching key multisets, order-independent', () => {
    const s = timedScene();
    const cell = { a: 0, b: 0 };
    const mk = (k: 'a' | 'b', from: number, to: number): Op => ({
      coalesceKey: `set:${k}`,
      apply: () => { cell[k] = to; },
      invert: () => mk(k, to, from),
    });
    s.applyBatch([mk('a', 0, 1), mk('b', 0, 1)], 'drag', null);
    vi.advanceTimersByTime(100);
    s.applyBatch([mk('b', 1, 2), mk('a', 1, 2)], 'drag', null); // reordered — multiset match
    expect(cell).toEqual({ a: 2, b: 2 });
    expect(s.historyEntries()).toHaveLength(1);
    s.undo();
    expect(cell).toEqual({ a: 0, b: 0 });
    s.redo();
    expect(cell).toEqual({ a: 2, b: 2 });
  });
});
```

(No `now` injection is added to the public options: `createHistory` defaults to a live `Date.now()` call, which vitest fake timers mock.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=kit src/core/scene/scene.test.ts`
Expected: FAIL — `coalesceWindowMs` is not a known `UseSceneOptions` member (type error), and entries don't merge.

- [ ] **Step 3: Add the option**

3a. In `src/core/scene/types.ts`, add to `UseSceneOptions` (after `historyLimit`):

```ts
  /** Window (ms) within which consecutive same-shaped mutations merge into
   *  the previous undo entry (matching per-op coalesce keys — e.g. repeated
   *  `setPose` on the same node, or repeated `applyBatch` calls whose ops
   *  carry matching `coalesceKey` multisets). `0` (default) disables
   *  coalescing: every mutation is a discrete undo entry. Undo of a
   *  coalesced entry returns to the state before the first merged mutation;
   *  redo restores the latest. `scene.batch` entries never coalesce. */
  coalesceWindowMs?: number;
```

3b. In `src/core/scene/scene.ts`, add to the `createHistory` options object (before `historyLimit` spread):

```ts
    ...(options.coalesceWindowMs !== undefined ? { coalesceWindowMs: options.coalesceWindowMs } : {}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=kit src/core/scene`
Expected: PASS — new coalescing tests AND the entire pre-existing suite (which runs with the option unset, proving `0` remains today's behavior).

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/types.ts src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): opt-in undo coalescing via coalesceWindowMs"
```

---

### Task 6: Full verification, docs, wrap-up

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Full release gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three PASS (this mirrors CI's release gate — vitest alone doesn't typecheck production code). If typedoc-style warnings surface about the new `EvictedEntry`/options exports, do NOT suppress them — surface the warning text for a decision.

- [ ] **Step 2: Update `docs/TODO.md`**

Two spots (verify line numbers by reading the file first):

2a. The quick-index line (near line 40):

```
- Op coalescing in `useScene`'s `LogEntry` history → [Selection, actions & UI panels](#selection-actions--ui-panels)
```

→ replace with:

```
- ~~Op coalescing in `useScene`~~ — done 2026-07-25; Phase 2 (serialization on the unified op-log) pending → [Selection, actions & UI panels](#selection-actions--ui-panels)
```

(Adapt to the list's actual done-marker convention if it differs — read neighboring entries.)

2b. The P2 body item (near line 253) — replace the whole bullet with:

```
- [x] **(P2) Op coalescing in `useScene`.** Done 2026-07-25 — `createScene` now delegates undo/redo to a `@weasel-js/history` instance (design: `docs/superpowers/specs/2026-07-25-unify-scene-history-engine-design.md`); opt-in via `UseSceneOptions.coalesceWindowMs` (default `0` = discrete entries, prior behavior). The engine gained `historyLimit` + `onEvict`; `applyBatch`'s non-journal fork now records on the same engine, so external-op batches coalesce too. Follow-up: **Phase 2** — clipboard / cross-reload serialization + persistence on the unified op-log (separate spec, not started).
```

(Adapt checkbox syntax to the file's convention. The block stays inline because the Phase 2 follow-up is open.)

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: mark useScene op-coalescing done; note Phase 2 follow-up"
```

- [ ] **Step 4: Finish the branch** — use superpowers:finishing-a-development-branch (merge back to `main` per the user's standing preference to be offered the merge; pushing requires separate explicit OK).

---

## Self-review notes (spec coverage)

- Op bridge / `makeOp` with direction flip → Task 3 Edit F.
- Engine wiring, `executeAndLog`/`batch`/`recordOp` (routes through `executeAndLog` unchanged)/`applyBatch` → Tasks 3 & 4.
- Public API mapping table (`undo`/`redo`/`canUndo`/`canRedo`/`historyEntries`/`historyIndex`/`jumpToHistoryIndex`) → Task 3 Edits H–I.
- `historyLimit` + `onEvict` engine surface → Tasks 1–2; scene pruning rewired → Task 3 Edit D.
- Opt-in `coalesceWindowMs`, default 0 → Task 5.
- Regression gate (unmodified `scene.test.ts` + full repo suite) → Task 3 Steps 3–4, Task 6 Step 1.
- New coalescing tests incl. multi-op multiset case → Task 5; engine eviction tests → Tasks 1–2.
- Not doing: serialization wiring, `RegisteredOp` shape changes, behavior changes at window 0 — none of the tasks touch these.
