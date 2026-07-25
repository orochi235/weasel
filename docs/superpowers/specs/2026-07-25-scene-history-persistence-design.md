# Scene undo-history persistence across reload — design (Phase 2a)

**Status:** approved 2026-07-25
**Packages:** `@weasel-js/core` (`src/core/scene/`), `@weasel-js/history` (`packages/history/`), `apps/draw`
**Predecessor:** `2026-07-25-unify-scene-history-engine-design.md` (Phase 1, shipped) — this is the
"Phase 2" it deferred, narrowed to history persistence. OS-clipboard serialization is a separate
future spec ("Phase 2b"); its wire format is node-snapshot-shaped, not op-log-shaped, so the two
do not share a spec.
**TODO items:** Selection, actions & UI panels → the Phase 2 follow-up recorded on the
"Op coalescing in `useScene`" done-block.

## Problem

Phase 1 put the scene's undo history on the `@weasel-js/history` engine, which already has
`serialize()`/`restore()` (`SerializedHistory`, `SerializedOp = (name, args)`, rebuilt via the
op-factory registry). But scene undo still dies on reload:

1. `Scene` exposes no serialize/restore surface — the engine instance is private.
2. Scene-native ops (`kit:add`, `kit:setPose`, …, plus consumer `registerOp` kinds) are `makeOp`
   wrappers over the scene's per-instance `registered` map. They are NOT in the **global**
   op-factory registry (and cannot be — their handlers close over per-scene state), so the
   engine's `restore()` would rebuild them as no-op placeholders.
3. Entries recorded by the non-journal `applyBatch` path hold **external** core ops
   (`transform`, `insert`, …). Those ARE globally rebuildable, but their `apply(adapter)` needs
   the canvas-adapter surface (`insertNode`/`removeNode`/`setData`/`setPath`/`setSelection`/…),
   which raw `Scene` does not satisfy — a restored external op has nothing to apply against.
   In apps/draw this is most of the stack: every drag/nudge/action commit is an external-op entry.
4. `kit:add` cannot re-attach `clipFromPose` after a reload: the function travels through the
   in-memory `pendingClipPatches` cache, which starts empty in a fresh session.

apps/draw already debounce-persists `scene.toJSON()` and `modality.history.serialize()` to
localStorage with a typed-array-aware `serializeReplacer`/`reviveTypedArrays` pair — the scene's
own history is the missing piece.

## Scope

End-to-end in apps/draw: kit surface (`serializeHistory`/`restoreHistory`/`setHistoryAdapter` +
engine `rebuildOp` hook + `clipKey` threading) AND draw wiring, so undo/redo demonstrably
survives a reload.

**Degradation stance (decided): pragmatic.** Unknown op kinds restore as no-op placeholders
(stack ordering survives; undoing such an entry does nothing) — existing engine rule.
Selection ops replay against whatever selection store exists post-reload. But `clipFromPose`
containers must redo correctly after reload (draw uses clips for user-visible content), hence
the `clipKey` threading below. Never throw mid-undo over a fidelity gap.

## Design

### 1. Engine: injectable rebuilder (additive)

`CreateHistoryOptions` gains:

```ts
/** Custom op rebuilder consulted by `restore()` before the global op-factory
 *  registry. Return null to fall through (global registry, then a no-op
 *  placeholder). Lets an owner rebuild ops whose handlers live in per-instance
 *  state the global registry can't reach. */
rebuildOp?: (name: string, args: unknown) => Op | null;
```

`restore()`'s per-op rebuild order becomes: injected hook → global `rebuildOp(name, args)` →
placeholder. Default behavior (no hook) is unchanged.

### 2. Scene surface

Three new `Scene` members plus internal wiring:

- **`serializeHistory(): SerializedHistory`** — delegates to `history.serialize()`. The engine's
  existing rule applies: entries containing any nameless op are dropped from the snapshot
  (scene-native and external ops always carry names; only hand-rolled anonymous ops passed to
  `applyBatch` are affected). Payload JSON-safety is the app's concern (draw's replacer handles
  typed arrays); the kit guarantees payloads contain no functions (`clipFromPose` travels as a
  registry key — see §4).

- **`restoreHistory(snapshot: SerializedHistory): void`** — delegates to `history.restore()`,
  then one `notify()`. **Contract:** call on a scene whose node/layer state already matches the
  snapshot's head state (i.e. right after `loadState`/construction from the paired scene
  snapshot). It replaces any existing history and does not mutate node state. Restored entries
  never coalesce with post-restore entries (existing engine timestamp-0 rule).

- **`setHistoryAdapter(fn: (() => unknown) | null)`** — accessor for the adapter that restored
  **external** ops apply against; mirrors `setActiveJournalAccessor` (post-construction wiring,
  swappable, `null` detaches).

- **Scene's rebuild hook** (passed to `createHistory`):
  1. `registered.has(name)` → `makeOp(name, args)`. Covers all `kit:*` kinds AND consumer
     `registerOp` kinds — consumer ops round-trip with zero consumer effort, provided the
     consumer registers the same kinds before `restoreHistory` (same ordering rule the global
     registry already imposes on op factories).
  2. Else `rebuildOp(name, args)` (global registry) → wrap in a **lazy** adapter binding:
     like `bindOpToAdapter`, but resolving `getHistoryAdapter()` at each `apply` call, so
     `setHistoryAdapter` wiring order doesn't matter. If the accessor is unset/null at apply
     time: `dwarn('scene', ...)` and return `'noop'` — consistent with the placeholder policy;
     never throws mid-undo.
  3. Else `null` → engine placeholder.

### 3. Restored-op equivalence

A restored `makeOp(name, args)` is behaviorally identical to the original (same handler lookup,
same payload, same `coalesceKey` derivation, same `invert()` flip). A restored external op is the
factory-rebuilt op (identical by the registry's contract) plus the lazy adapter binding, which
preserves `name`/`args`/`label`/`coalesceKey` and forwards the no-op signal — same guarantees as
the live `bindOpToAdapter` path.

### 4. `clipFromPose` across reload (`clipKey`)

`scene.add` stamps an optional `clipKey?: string` into the `kit:add` payload when the spec has a
`clipFromPose` present in the scene's reverse registry (same lookup `toJSON` uses; specs whose
function isn't registered stamp nothing — matching `toJSON`'s stricter posture is unnecessary
here since history is best-effort). `kit:add`'s apply re-attaches, in order: `pendingClipPatches`
cache (live path, unchanged) → `clipKey` registry lookup (restore path; also seeds the cache so
subsequent undo/redo cycles behave like the live path). Payloads stay function-free.

### 5. apps/draw wiring

- New localStorage key **`weaseldraw:scene-history-v1`**, written in the existing debounced
  persistence effect via `serializeReplacer`, alongside the scene and modality-history keys.
- Boot: after the scene snapshot loads (`nodeSpecsFromSnapshot`/`loadState` path), parse with
  `reviveTypedArrays` and call `scene.restoreHistory(snap)`. On parse failure, missing key, or
  `snapshot.version !== 1`: skip restore and remove the key (wipe, no migration — exploratory
  app).
- Wire `scene.setHistoryAdapter(() => adapter)` to the same adapter instance the actions commit
  through (resolution of the exact wiring point — app-level vs SceneCanvas auto-wiring — is an
  open question below).
- `modality.history` persistence (journal parent) is untouched.

## What we explicitly are NOT doing

- OS clipboard / paste wire format (Phase 2b, separate spec).
- IndexedDB, storage quotas, cross-version migration (wipe on mismatch instead).
- Serializing suspended journals or the active-journal seam.
- Auto-persistence in the kit (persistence cadence, storage, and replacers stay app concerns).
- Changing the public `RegisteredOp` shape or any Phase 1 behavior.

## Testing

- **Engine:** `rebuildOp` hook precedence (hook wins), fallback to global registry, fallback to
  placeholder; hook receiving exactly the serialized `(name, args)`.
- **Scene round-trips** (serialize → fresh scene with equivalent state → `restoreHistory`):
  native-op entries undo/redo correctly; consumer `registerOp` ops round-trip; external-op
  entries replay through the lazy adapter (set before AND after `restoreHistory` — order
  independence); unset adapter → undo is a warning no-op, no throw; unknown kind → placeholder;
  clip container redo-after-restore re-attaches `clipFromPose` via `clipKey`;
  `restoreHistory` replaces pre-existing history; restored entries don't coalesce with new ones.
- **Live-path regression:** full existing scene suite unmodified (`clipKey` stamping must not
  disturb any current test); full repo suite + release gate (`typecheck && test && build`).
- **Draw:** persistence round-trip of the new key through `serializeReplacer`/`reviveTypedArrays`
  with pose/path payloads containing typed arrays.

## Open questions (resolve at planning / implementation)

1. **Adapter wiring point in draw** — app-level (`App.tsx` wires `setHistoryAdapter` where it
   obtains the canvas adapter) vs `SceneCanvas` auto-wiring it for every consumer. Default:
   app-level for now (smallest surface; auto-wiring can come later if a second consumer wants it).
2. **`kit:remove` payload size** — subtree snapshots in history payloads can be large; confirm
   draw's localStorage budget tolerates worst-case stacks (mitigation if needed: draw sets
   `historyLimit`, which it arguably should anyway).
3. **`serializeHistory` during an open batch/journal** — define as "caller shouldn't"; confirm
   whether a guard (throw vs dwarn-and-snapshot-anyway) is warranted at implementation.

## Files (anticipated)

- `packages/history/src/history.ts` — `rebuildOp` option + `restore()` order; tests.
- `src/core/scene/scene.ts` — `serializeHistory`/`restoreHistory`/`setHistoryAdapter`, rebuild
  hook, lazy adapter binding, `clipKey` stamping + re-attach.
- `src/core/scene/types.ts` — the three new `Scene` members' declarations + docs.
- `src/core/scene/scene.test.ts` — round-trip suite.
- `apps/draw/src/App.tsx` + `apps/draw/src/persistence.ts` — key, debounced write, boot restore,
  adapter wiring.
