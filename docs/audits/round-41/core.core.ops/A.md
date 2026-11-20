# Findings: core.core.ops (round 41)

## setPath reports a no-op for a path change that only touches fillRule, openFill or corners, so history drops an edit it applied
- where: packages/core/src/core/ops/setPath.ts:69 (pathEqual), :51 (apply)
- scenario: `ops.setPath({ id, from: { path: p, closed, params }, to: { path: { ...p, fillRule: 'evenodd' }, closed, params } })` (or a `to.path` that differs only in `openFill` or `corners`). `pathEqual` compares only `kind`, `origin`, `commands` and `coords`, so `fieldsEqual` is true, `apply` calls `setPath` (the scene now holds evenodd) and returns `false`. When that is the batch's only op, `pushOrCoalesce` skips the entry and Cmd+Z cannot undo the change. It should report a change: `PolygonPath`'s `fillRule`, `openFill` and `corners` (packages/geom/src/path.ts:27–49) are part of the shape.
- evidence: read
- severity: medium

## setPath and setSelection decide "no-op" from the stated `from`, not from what the node holds, so a stale `from` loses the undo entry
- where: packages/core/src/core/ops/setPath.ts:51 (apply); packages/core/src/core/ops/select.ts:30 (apply)
- scenario: a caller builds `setPath({ from: X, to: X })` when the node actually holds Y (the `from` was captured before another write). `apply` writes X over Y and returns `false`, so history records nothing and the overwrite of Y cannot be undone. `setSelection({ from: ['a'], to: ['a'] })` while the live selection is `['b']` does the same. `setPose` fixed exactly this case: "The node is the answer where it can be read: a stated `from` can be stale" (setPose.ts:32–35). `setData`, `setLayer`, `setHidden`/`setLocked`, `setDependsOn` and `setLayout` all ask `alreadyHolds`. These two answer the same question the other way.
- evidence: read
- severity: medium

## writtenBy rebuilds op copies through defaultOpRegistry instead of the scene's own opRegistry
- where: packages/core/src/core/ops/writtenBy.ts:49 (copyOf)
- scenario: a scene created with `opRegistry: createOpRegistry({ parent: null })`, or one whose registry registers a host factory under a kit name with different behaviour. `writtenBy(sc, ops)` resolves each op's copy through `defaultOpRegistry` (aa27d9fd37 swapped `rebuildOp` for it), not `sc.opRegistry`, which the scene exposes (historyForm.ts:58). An op only the host registry knows gets no copy, so the real op is applied to the recorder. That spends the first apply the function's own docstring says "belongs to the real one" (ops that record their undo on first apply then capture it against the recorder). A host-overridden kit name is read through the kit's factory, not the host's, so the poses and data it reports are not the ones the real apply writes.
- evidence: read
- severity: low

## createDeleteOp observes the slot under the parent of the op's input node before switching to the live node, so a stale copy loses the anchor
- where: packages/core/src/core/ops/delete.ts:112 (apply)
- scenario: `createDeleteOp({ node: staleCopy, index })` where `staleCopy.parent` is an old parent (the node has since been reparented). `captureSlot(a, parentOf(node), …)` looks in the old parent's children, finds nothing and keeps `slotFromIndex(index)` with no `before` anchor. Only afterwards (line 120) is `node` replaced by the live node, whose real parent is what the inverse insert resolves against. Undo then places the node by ordinal alone, which slot.ts:10–15 documents as clamping to the end when a batch's inverses replay in reverse. The slot should be captured under the live node's parent: look up the live node first, then call `captureSlot`.
- evidence: read
- severity: low

## setText never reports a no-op, unlike its sibling field ops
- where: packages/core/src/core/ops/setText.ts:28 (apply)
- scenario: `setText({ id, from: 'a', to: 'a' })`, or a write of the text the node already holds. `apply` always returns `undefined`, so history pushes an undo entry that changes nothing. A text commit that did not change the text adds a dead Cmd+Z step and a dirty flag. `setData`, `setPose`, `setLayer` and the rest return `false` through `alreadyHolds`, or by comparing `from`/`to`, in exactly this case.
- evidence: read
- severity: low

## Files read
packages/core/src/core/ops/alreadyHolds.ts
packages/core/src/core/ops/arrange.ts
packages/core/src/core/ops/create.ts
packages/core/src/core/ops/createHistory.ts
packages/core/src/core/ops/delete.ts
packages/core/src/core/ops/index.ts
packages/core/src/core/ops/nodeFlags.ts
packages/core/src/core/ops/nodeOps.ts
packages/core/src/core/ops/registry.ts
packages/core/src/core/ops/reorder/algorithms.ts
packages/core/src/core/ops/reorder/index.ts
packages/core/src/core/ops/reorder/setChildOrder.ts
packages/core/src/core/ops/reparent.ts
packages/core/src/core/ops/select.ts
packages/core/src/core/ops/setData.ts
packages/core/src/core/ops/setDependsOn.ts
packages/core/src/core/ops/setLayer.ts
packages/core/src/core/ops/setLayout.ts
packages/core/src/core/ops/setPath.ts
packages/core/src/core/ops/setPose.ts
packages/core/src/core/ops/setText.ts
packages/core/src/core/ops/slot.ts
packages/core/src/core/ops/types.ts
packages/core/src/core/ops/writtenBy.ts

<!-- done: 5 findings, files read: 24 -->
