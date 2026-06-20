# useScene user-layer mutation methods — design

**Date:** 2026-06-19
**Status:** Approved, pending implementation
**TODO item:** "`useScene`: user-layer mutation methods" (P2, Scene/adapters/layout)

## Problem

Layers are fixed at construction via `systemLayers`. The only post-construction
layer mutations are `setLayer` (re-tag a node), `setLayerVisible`, and
`setLayerLocked`. There is no way to add, remove, rename, or reorder a layer at
runtime, so a consumer cannot offer a layers panel with create/delete/reorder.

The type system already anticipates this: `LayerRecord` is a union of
`SystemLayerRecord` (`kind: 'system'`) and `UserLayerRecord` (`kind: 'user'`,
carries a `name`), but nothing constructs the `user` variant.

## Design

Four new methods on `Scene<TData, TLayer, TPose>`, all auto-undoable (matching
the existing `setLayerVisible`/`setLayerLocked` kit ops):

```ts
addLayer(spec: AddLayerSpec<TLayer>): void;
removeLayer(layer: TLayer): void;
renameLayer(layer: TLayer, name: string): void;
moveLayer(layer: TLayer, index: number): void;
```

where

```ts
interface AddLayerSpec<TLayer extends string> {
  id: TLayer;
  name: string;
  visible?: boolean; // default true
  locked?: boolean;  // default false
  index?: number;    // default: top of stack (highest render index)
}
```

### Semantics

**`addLayer`** — inserts a new `UserLayerRecord` (`kind: 'user'`, carrying
`name`). When `index` is omitted the layer goes to the **top** of the stack
(highest render index, i.e. `state.layers.length`); otherwise it splices at the
clamped `index`. Throws on a duplicate id (`requireLayerIndex`-style guard
inverted). `visible` defaults to `true`, `locked` to `false`.

**`removeLayer`** — **user layers only**; throws if the target is a system
layer (system layers are construction-fixed). Cascade-deletes every node tagged
to the layer, then removes the layer record. Both happen inside one `batch()`
so a single undo restores the layer record *and* all its nodes. Node deletion
reuses the existing `remove()` path (which already cascades each node's
subtree); the layer-record removal is its own `kit:removeLayer` op recorded in
the same batch.

> Cascade is structurally unavoidable: deleting a container deletes its whole
> subtree regardless of the children's layer tags, so "delete the layer's
> nodes" already implies removing descendants that may live on other layers.

**`renameLayer`** — **user layers only**; throws on a system layer (system
layers have no `name` field). Updates `name` in place.

**`moveLayer`** — splices the layer record to a new (clamped) index. Validates
the subtree invariant *before* mutating: throws if the reorder would place any
node below an ancestor's layer index or above a descendant's (i.e. would
violate `assertSubtreeLayer` for any existing node). Both system and user
layers may be moved.

### Implementation

New kit ops, registered alongside the existing `kit:setLayer*` ops in
`createScene`:

- **`kit:addLayer`** — payload `{ record: UserLayerRecord<TLayer>, index }`.
  `apply` splices the record into `state.layers` at `index`; `revert` removes
  it. Both call a shared `rebuildLayerIndex()` afterward.
- **`kit:removeLayer`** — payload `{ record: LayerRecord<TLayer>, index }`.
  `apply` removes the record at `index`; `revert` re-splices it. The node
  deletions ride the existing `remove()`/`kit:*` ops already in the batch, so
  this op covers only the layer record. Both rebuild `layerIndex`.
- **`kit:renameLayer`** — payload `{ layer, from, to }`. `apply` sets `name = to`,
  `revert` sets `name = from`. No index rebuild needed.
- **`kit:moveLayer`** — payload `{ layer, from, to }` (indices). `apply` moves
  the record `from`→`to`, `revert` moves it back. Both rebuild `layerIndex`.

`rebuildLayerIndex()` is a small helper that repopulates `state.layerIndex` from
`state.layers` (indices shift whenever a layer is inserted, removed, or moved).
Today `layerIndex` is built once at construction; these ops are the first
operations that reorder it, so the helper is new.

`removeLayer`'s cascade collects nodes to delete by repeatedly removing any
still-present node whose `layer === id` (each `remove()` cascades its subtree,
so picking the highest remaining node each pass avoids double-removal),
wrapped in `batch('removeLayer', …)` together with the `kit:removeLayer` op.

`TLayer` stays generic. Consumers who want runtime-dynamic layer ids type their
scene as `Scene<TData, string, TPose>` — the existing escape hatch; no new
dynamic-id machinery is introduced.

### Type changes

- Export `AddLayerSpec<TLayer>` from `core/scene/types.ts`.
- Add the four method signatures to the `Scene` interface (in the "Mutations
  (all auto-undoable)" block, next to `setLayerVisible`/`setLayerLocked`).

## Testing

Extend `src/core/scene/scene.test.ts`:

- `addLayer` — appends to top by default; respects explicit `index`; produces a
  `kind: 'user'` record with the given `name`; throws on duplicate id.
- `removeLayer` — drops the record and cascade-deletes tagged nodes (including
  subtrees that span other layers); throws on a system layer.
- `renameLayer` — updates `name`; throws on a system layer.
- `moveLayer` — reorders; clamps out-of-range `index`; throws when the reorder
  would violate the child-below-parent invariant; allowed on system layers.
- Undo/redo round-trips for all four, with explicit coverage that undoing a
  `removeLayer` restores both the layer record and every deleted node.
- `layerIndex` integrity: after each mutation, every layer's `layerIndex` entry
  equals its position in `state.layers` (assert via a follow-on `setLayer` /
  `renderOrder` that depends on correct indices).

## Out of scope

- Per-layer reordering UI / a `<LayersPanel>` component (consumer concern).
- Moving nodes between layers on remove (we cascade-delete instead, per the
  approved decision).
- Reparent-to-neighbor or reject-on-nonempty `removeLayer` variants (rejected).
