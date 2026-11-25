I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document is below. One more thing: the checkout's HEAD is a22801b42b, not the frozen commit b400d703 that the brief names. I read the files as they are in this tree.

# Audit round 58 — ui.components.LayerList

## A locked layer refuses drops into it but lets its children be dragged out, renamed and removed
- where: packages/ui/src/components/LayerList/LayerList.tsx:51 (canDrop), layerNodes.tsx:34 (immovable), RowParts.tsx:16 (canRename), layerNodes.tsx:70 (remove slot)
- scenario: take items `[{ id: 'g', locked: true, children: [{ id: 'g1' }] }]` with onReorder, onRename and onRemove.
  - A drop into `g` is refused, and so is reordering g1 among g's children.
  - But g1 is not `immovable`, so dragging g1 to the top level succeeds and takes it out of the locked layer. g1 also gets a rename field and a remove button.
  - The lock is only checked on the row itself and on the direct drop parent, never on ancestors. A drop into a grandchild of a locked layer is allowed too.
  - So "the layer's content is locked" (layerListProps.ts:16) holds for adding to the layer but not for taking from it or editing it. The lock should apply both ways or neither.
- evidence: read
- severity: medium

## A rename left open when the list is held reopens by itself and steals focus when the hold lifts
- where: packages/ui/src/components/LayerList/RowParts.tsx:37 (RowLabel), LayerList.tsx:31 (renaming state)
- scenario: the user opens a rename (double-click or F2), then `disabled` or `readOnly` turns on, or a hold scope does, while the field is open.
  - `RowLabel` switches to the plain label and unmounts `RenameField` without its `onBlur` running, so `finish` never runs. The draft is lost with no `onRename`, and `renaming` keeps the row's id.
  - When the hold lifts, a new field mounts with `autoFocus` and takes focus away from wherever the user is, with no gesture from them.
  - The same happens if the row becomes locked or fixed, or is removed and later restored with the same id (undo).
- evidence: read
- severity: medium

## Opening and leaving the rename field renames a layer whose label has surrounding whitespace
- where: packages/ui/src/components/LayerList/RowParts.tsx:53-54 (RenameField.finish)
- scenario: a layer `{ label: 'Layer 1 ' }`. The user opens the rename field, changes nothing, and clicks away. `draft.trim()` gives `'Layer 1'`, which is `!== item.label`, so `onRename` fires an edit (and an undo step) the user never made. The trimmed draft is compared with the untrimmed label.
- evidence: read
- severity: low

## The uncontrolled fold map keeps every toggled id forever
- where: packages/ui/src/components/LayerList/LayerList.tsx:30,46 (HeldLayerList toggled)
- scenario: in an uncontrolled list (no `collapsedIds`), every fold or unfold adds the id to `toggled` through `new Map([...prev, ...changed])`. Nothing ever removes ids of deleted layers. If layers keep being created and deleted, the map grows without bound, and every toggle copies all of it.
- evidence: read
- severity: low

## `moveLayers` silently drops the moved layers when the target parent is missing or is being moved
- where: packages/ui/src/components/LayerList/layerTree.ts:26-47 (moveLayers)
- scenario: `moveLayers(items, { ids: ['a'], parentId: 'gone', index: 0 })`, or a move into one of the moving rows or their descendants. `lift` takes the block out first, then `into` never finds the parent and returns the lifted tree, so the moved layers vanish without an error. This is the exported helper for consumers who hold the tree as state, so a stale or externally built move loses data.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/LayerList/LayerList.module.css
packages/ui/src/components/LayerList/LayerList.stories.module.css
packages/ui/src/components/LayerList/LayerList.stories.tsx
packages/ui/src/components/LayerList/LayerList.tsx
packages/ui/src/components/LayerList/RowParts.tsx
packages/ui/src/components/LayerList/index.ts
packages/ui/src/components/LayerList/layerList.fixture.tsx
packages/ui/src/components/LayerList/layerListProps.ts
packages/ui/src/components/LayerList/layerNodes.tsx
packages/ui/src/components/LayerList/layerSolo.ts
packages/ui/src/components/LayerList/layerTree.ts

<!-- done: 5 findings, files read: 11 -->