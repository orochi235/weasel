# Unify `useScene`'s undo history onto the `@weasel-js/history` engine — design

**Status:** approved 2026-07-25 (Phase 1 scope)
**Packages:** `@weasel-js/core` (`src/core/scene/scene.ts`, `useScene`), `@weasel-js/history` (`packages/history/`)
**TODO item:** Selection, actions & UI panels → "Op coalescing in `useScene`" (P2)

## Problem

The kit has **two parallel undo engines**:

1. **`@weasel-js/history`** (`packages/history/`) — op-batched, with `coalesceKey`
   coalescing (`coalesceWindowMs`), a base/forward entry model, `touchedIds`,
   serialize/deserialize, `subscribe`/`version`, `entries()`, `goto()`,
   `recordEntry` (record-without-apply), and journals.
2. **`createScene`'s own `LogEntry` stack** (`src/core/scene/scene.ts`) — a separate
   `{ id, label, ops: {kind,payload}[] }[]` undo/redo pair with **no coalescing**;
   `Op.coalesceKey` is structurally dropped at the `LogEntry` boundary.

The two only meet at the journal seam (`applyBatch`): when a journal is active, ops
route to `@weasel-js/history` (which coalesces) and scene recording is suppressed;
with no journal, `applyBatch` falls back to `scene.batch` (no coalescing). So a drag
driven through the scene's native path produces one undo entry **per pointer-move
frame** — the exact thing coalescing exists to prevent.

Rather than port the coalesce algorithm into the scene as a second copy (band-aid),
we **unify**: `createScene` delegates its undo/redo to a `@weasel-js/history` instance.
This kills the duplication, gives coalescing for free, and sets up the related
clipboard / cross-reload-serialization P2 (which also wants the `@weasel-js/history`
op-log shape) to land on the same engine later.

## Scope

**Phase 1 (this spec):** swap the engine; preserve **all** current behavior (guarded
by `scene.test.ts`); add **opt-in** coalescing via `coalesceWindowMs` (default `0` =
today's behavior). Deliverable: coalescing works on the scene's native path; one
history engine.

**Phase 2 (separate spec, later — OUT OF SCOPE):** clipboard / cross-reload
serialization + persistence on the unified op-log, leveraging the engine's existing
`serialize`/`deserialize`.

## Design

### The op bridge (the crux)

The scene's `RegisteredOp = { apply(payload), revert(payload) }` registry stays as the
state-mutation layer. A `@weasel-js/history` `Op` is a thin **direction-flipping
wrapper** over it:

```ts
function makeOp(kind: string, payload: unknown, dir: 'fwd' | 'rev' = 'fwd'): Op {
  const handler = registered.get(kind);
  if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
  return {
    apply: () => { (dir === 'fwd' ? handler.apply : handler.revert)(payload); },
    invert: () => makeOp(kind, payload, dir === 'fwd' ? 'rev' : 'fwd'),
    coalesceKey: `${kind}:${idOf(payload)}`,
    // name/args carried for serialize() in Phase 2; label lives on the entry.
  };
}
```

This works generically for **every** op — symmetric `{from,to}` ops
(`kit:setPose`/`setData`/`setLayer`/layer visible·locked·rename·move), asymmetric
structural ops (`kit:add` ⇄ `kit:remove`, whose existing `revert` already re-adds from
the captured `RemoveSnapshot`), and consumer-registered ops via `registerOp` — because
every `RegisteredOp` already carries a correct `revert`. **No per-op inverse code.**
On undo, `@weasel-js/history` applies `baseOps.map(op => op.invert())` (the `rev`
wrappers → `handler.revert`); on redo it re-applies the stored forward ops
(`handler.apply`). Coalescing preserves `baseOps`, so undo always returns to the
original from-state.

`idOf(payload)` reads `payload.id` for node ops and `payload.layer` for layer ops
(the coalesce key is a best-effort grouping token; ops with no id fall back to the
kind alone or opt out — see Open Questions).

### Engine wiring in `createScene`

`createScene` constructs one history: `const history = createHistory(adapter, {
coalesceWindowMs, onEvict })`. The `adapter` is the scene's state accessor (ops close
over `registered`/`runOp`, so the adapter arg is effectively unused — acceptable).

Mutation paths:
- **`executeAndLog(kind, payload, label)`** → when not batching,
  `history.applyOps([makeOp(kind, payload)], label)` (applies + records + coalesces).
  The old separate `runOp` call is removed (apply happens inside `applyOps`).
- **`batch(label, fn)`** → apply each op **live** as it is issued (so state is
  readable mid-batch, as today), buffer the ops, and on the outermost close call
  `history.recordEntry(bufferedOps, label)` (record-without-apply). Nested batches
  collapse into the outer, as today.
- **`recordOp(op)`** → same as `executeAndLog` with the consumer's kind/payload.
- **`applyBatch(ops, label, adapter)`** — the journal fork **collapses**: with the
  native path now being the same engine, the non-journal branch routes through the
  same `history.applyOps` instead of `scene.batch`. (Journal-active behavior is
  unchanged; confirm the journal accessor still composes — see Open Questions.)

### Public API mapping (zero behavior change)

| `useScene` surface (today) | Re-expressed over `history` |
|---|---|
| `undo()` / `redo()` | `history.undo()` / `history.redo()` (+ scene `notify()`) |
| `canUndo()` / `canRedo()` | `history.canUndo()` / `history.canRedo()` |
| `historyEntries()` → `{id,label}[]` | flatten `history.entries().undo` + `.redo` to `{id,label}` in the same oldest-first order |
| `historyIndex()` | `history.entries().undo.length` |
| `jumpToHistoryIndex(n)` | `history.goto(n)` |

React notification: bridge `history.subscribe(...)` → the scene's existing `notify()`
(or keep `notify()` explicit at each call site — pick one, don't double-fire). The
`replaying` flag is no longer needed to gate scene-side recording during undo/redo
(the engine owns that) but may still gate journal interplay — audit at implementation.

### New surface on `@weasel-js/history` (small, additive)

1. **`historyLimit?: number`** on `CreateHistoryOptions` — cap the undo stack; evict
   oldest on overflow. The scene passes its `historyLimit`.
2. **`onEvict?: (entry: HistoryEntry) => void`** on `CreateHistoryOptions` — fired when
   an entry leaves the reachable stacks (redo cleared on branch-edit, or evicted by
   `historyLimit`). The scene wires `pruneCacheForDroppedEntries` to it, replacing the
   inline pruning in the old `pushEntry`.

Both are opt-in and default to today's behavior (unbounded, no callback) so existing
`@weasel-js/history` consumers are unaffected.

### Scene-side concerns that stay

- `notify()` / `currentBatch` batching, `pendingClipPatches`, container-add
  `clipFromPose` — these are scene-domain concerns, not history concerns; they remain
  in `scene.ts`, now hanging off the new wiring (e.g. clip-patch pruning off `onEvict`).

## What we explicitly are NOT doing (Phase 1)

- No serialization / persistence wiring (Phase 2).
- No change to the **public** `RegisteredOp` shape (`apply`/`revert` stays — consumer
  `registerOp` API unchanged).
- No change to observable undo/redo behavior when `coalesceWindowMs` is `0`.

## Testing

- **Regression gate:** the entire `src/core/scene/scene.test.ts` suite
  (batch grouping, auto-undoable mutations, custom-op seam, container-add clip
  undo/redo, `pendingClipPatches` pruning, user-layer undo, `jumpToHistoryIndex`,
  `historyEntries`) must stay green with `coalesceWindowMs` unset — proves the engine
  swap is behavior-preserving. Plus the full repo suite green (scene is widely consumed).
- **New coalescing tests** (scene-level, mirroring `@weasel-js/history`'s
  `history.test.ts` coalescing cases with an injected clock): within-window same-key
  drag collapses to one entry; undo returns to the original pre-drag state; redo
  reaches the final state; outside-window pushes a discrete entry; different key →
  discrete; multi-op (multi-select) batch coalesces on matching key multiset.
- **New `@weasel-js/history` tests** for `historyLimit` eviction and the `onEvict`
  callback firing on branch-edit redo-clear and on overflow.

## Open questions (resolve at planning / implementation)

1. **Coalesce key for id-less ops.** Ops without a `payload.id`/`payload.layer`
   (e.g. structural batches) — fall back to kind-only key, or omit the key (opt out of
   coalescing)? Default: **omit** (no key → never coalesces), matching
   `@weasel-js/history`'s "missing key on either side → new entry" rule.
2. **Does `recordEntry` coalesce?** Batches flush via `recordEntry`; confirm whether it
   runs the coalesce check or is intentionally discrete. If discrete, batches never
   coalesce with each other (probably fine — an explicit batch is already one entry).
3. **Journal accessor composition** — verify `setActiveJournalAccessor` / journal
   begin/resume still composes when the native path is the same engine (the fork
   collapse must not break the journal seam).
4. **`notify()` bridging** — subscribe-based vs. explicit-per-call; pick the one that
   fires exactly once per user-visible mutation (no double-render).

## Files (anticipated)

- `packages/history/src/history.ts` — add `historyLimit` + `onEvict` options and their
  logic; tests in `packages/history/src/`.
- `src/core/scene/scene.ts` — replace `undoStack`/`redoStack`/`pushEntry`/`undo`/`redo`
  and the inline coalesce-free logging with a `createHistory` instance + `makeOp`
  bridge; re-express the public undo API; move cache-pruning to `onEvict`; collapse the
  `applyBatch` non-journal fork.
- `src/core/scene/types.ts` — `UseSceneOptions` gains `coalesceWindowMs?: number`.
- `src/core/scene/scene.test.ts` — new coalescing tests; existing suite is the gate.
