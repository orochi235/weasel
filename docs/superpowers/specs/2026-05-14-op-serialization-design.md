# Op serialization & persistent history

## Problem

The kit's `Op` is a behaviorally-typed value:

```ts
interface Op {
  label?: string;
  coalesceKey?: string;
  apply(adapter: unknown): boolean | 'noop' | void;
  invert(): Op;
}
```

The `apply` and `invert` methods are closures captured at the call site of each factory (`createInsertOp({ node })`, `createSetPathOp({ id, from, to })`, etc.). Closures can't be serialized — that's why `History.entries()` returns runtime-only data and the undo stack vanishes on reload.

If we want to **persist history alongside the scene** (so refresh doesn't blow away the undo/redo stack), every op needs to round-trip through a string + JSON form. The closure-only design blocks that.

## Goal

`History` survives `IndexedDB` round-trip: save → reload → undo continues working exactly as if the page hadn't reloaded. Both the undo stack and the redo stack restore.

## Proposal

Add an **op-factory registry** to the kit. Each kind of op tags itself with a stable name and a (args) → Op rebuilder. Serialization captures `{ name, args }` per op; restoration walks the registry to rebuild the live `Op` objects with their apply/invert closures intact.

### Op runtime shape (additive)

```ts
interface Op {
  label?: string;
  coalesceKey?: string;
  // NEW — present on every kit-emitted op. Consumer ops without a name
  // are persisted as opaque placeholders that no-op on apply.
  name?: string;
  args?: unknown;
  apply(adapter: unknown): boolean | 'noop' | void;
  invert(): Op;
}
```

Factories stamp `name` and `args` onto the op they return:

```ts
export function createInsertOp<TNode extends { id: string }>(args: {
  node: TNode;
  label?: string;
}): Op {
  const { node, label } = args;
  return {
    name: 'insert',
    args: { node, label },
    label,
    apply(adapter) { (adapter as InsertAdapter<TNode>).insertNode(node); },
    invert() { return createDeleteOp({ node, label }); },
  };
}
```

Same for `createDeleteOp` (`'delete'`), `createTransformOp` (`'transform'`), `createSetPathOp` (`'setPath'`), `createSetTextOp` (`'setText'`), `createReparentOp` (`'reparent'`), `createMoveToIndexOp` (`'moveToIndex'`), `createSetSelectionOp` (`'setSelection'`). Each takes serializable args; the closure reads them.

### Registry

```ts
// src/core/ops/registry.ts
const FACTORIES = new Map<string, (args: unknown) => Op>();

export function registerOpFactory<A>(
  name: string,
  build: (args: A) => Op,
): void {
  FACTORIES.set(name, build as (args: unknown) => Op);
}

export function rebuildOp(name: string, args: unknown): Op | null {
  const f = FACTORIES.get(name);
  return f ? f(args) : null;
}
```

The kit calls `registerOpFactory` at module-init time for every built-in factory. Consumers (e.g., swillustrator's own ops, if any) register theirs in app bootstrap before `History` is instantiated.

### Serialized form

```ts
interface SerializedOp {
  name: string;
  args: unknown;
}

interface SerializedEntry {
  id: number;
  label: string;
  forwardOps: SerializedOp[];
  baseOps: SerializedOp[];
}

interface SerializedHistory {
  version: 1;
  undoStack: SerializedEntry[];
  redoStack: SerializedEntry[];
  nextEntryId: number;
}
```

### History API additions

```ts
interface History {
  // existing: apply, applyOps, undo, redo, canUndo, canRedo, clear,
  // entries, goto, getVersion, subscribe ...

  /** Snapshot the stack in serializable form. Skips entries with any op
   *  missing a `name` — those can't round-trip, so persistence omits
   *  them rather than silently dropping op detail. */
  serialize(): SerializedHistory;

  /** Replace the current stack with a deserialized one. Each op is
   *  rebuilt via the registry; unknown names return a no-op placeholder
   *  so the entry still occupies its slot for ordering. */
  restore(snapshot: SerializedHistory): void;
}
```

`serialize()` reads `forwardOps` and `baseOps` directly; the `name` + `args` fields are already attached by the factory.

`restore()` walks the snapshot, rebuilds each op via `rebuildOp(name, args)`, falls back to a no-op placeholder if the registry doesn't have the name (and logs at debug level). The placeholders mean a forward-compat reload after a kit downgrade still loads — undo through one becomes a visual no-op rather than a crash.

### Persistence wiring

In swillustrator's `usePersistedScene` (already designed for items/groups/doc/view):

```ts
interface SceneSnapshot {
  version: 1;
  items: Obj[];
  groups: Group[];
  doc: Document;
  view: View;
  selection: NodeId[];     // already in the parallel plan
  history: SerializedHistory;  // ← new
}
```

On save: `historyRef.current!.serialize()`. On restore: `historyRef.current!.restore(snapshot.history)`. History restore runs **after** scene restore so the undo stack's first invert lands on the correct restored state.

### Migration: which factories to register

| Factory                  | Name           | Args (serializable shape)                                  |
|--------------------------|----------------|------------------------------------------------------------|
| `createInsertOp`         | `insert`       | `{ node }`                                                 |
| `createDeleteOp`         | `delete`       | `{ node }`                                                 |
| `createTransformOp`      | `transform`    | `{ id, from, to }`                                         |
| `createSetPathOp`        | `setPath`      | `{ id, from, to }`                                         |
| `createSetTextOp`        | `setText`      | `{ id, from, to }`                                         |
| `createReparentOp`       | `reparent`     | `{ id, fromParentId, toParentId }`                         |
| `createMoveToIndexOp`    | `moveToIndex`  | `{ ids, parentId, index, prevPositions }`                  |
| `createSetSelectionOp`   | `setSelection` | `{ from, to }`                                             |

For ops that capture a `node` (insert/delete): the node is a consumer-defined shape, but it's already serialized — every field on it must be IDB-compatible (numbers, strings, Float32Arrays, etc.). The kit doesn't validate; the consumer is responsible for keeping its node type serializable, same as for the scene snapshot.

### Edge cases

- **Unknown op name on restore.** Rebuild as a placeholder op with `apply: () => 'noop'` and `invert: () => self`. Logged at debug level. Keeps stack ordering intact.
- **Args shape drift across kit versions.** Adding a field to an op's args is safe (older args lack it; default at rebuild time). Renaming or removing a field is a breaking change — bump the kit's persisted version and migrate or discard.
- **Coalesced entries.** Coalesce already happens at op-emission time, so the persisted entry already reflects the coalesced state. No special handling.
- **Custom ops from consumers.** If a consumer emits an op without a `name`, persistence silently drops the containing entry (with a debug log). Consumers wanting history persistence must register their factories.
- **Adapter binding.** History today is bound to an adapter via a Proxy in swillustrator's setup. Restored ops call adapter methods through the same Proxy on apply — the live adapter is current at apply time. No adapter snapshot needed.

## Out of scope

- **Cross-document history** (porting history between documents). Single-doc only.
- **Compression**. Plain JSON-via-structured-clone is fine for v1; histories with thousands of entries are rare in illustration apps. Revisit when a real consumer hits a quota.
- **Time-travel UI hooks**. Persistence is invisible; the existing History panel already gives time-travel within a session and the same UI works post-reload without changes.
- **Multi-tab synchronization**. Two tabs writing to the same IDB record race. Last write wins; that's fine for v1 (no real collaboration expectation).

## Acceptance criteria

- After a reload, the undo stack contains exactly the same entries (label, ordering) it had pre-reload. Undo / redo continue from the same position.
- The History panel displays the restored entries the moment the canvas paints; no flicker, no async loading state required (IDB read is part of the same boot path that hydrates items/groups/doc/view).
- A snapshot taken before a kit version with an unknown op name still loads — the unknown entries become no-op placeholders. Reload then save again writes the same shape back (with placeholders preserved or dropped — pick one and document).
- Existing in-memory history tests keep passing; new tests cover serialize / restore round-trip per op factory.

## Plan

Two stages:

**Stage 1 — registry + factory tagging.** Half a day. Add `name` + `args` to every kit-emitted op factory. Add `registerOpFactory` and `rebuildOp`. Tests: per-factory round-trip (`rebuildOp(op.name!, op.args!)` produces an op whose apply/invert behave identically).

**Stage 2 — history serialize/restore + persistence wiring.** Half a day. Add `History.serialize()` / `History.restore()`. Wire into swillustrator's IDB scene snapshot. Tests: scene + history round-trip via the IDB shim used by `sceneStore.test.ts`.

Total: ~1 day. Independent of any other work in flight.
