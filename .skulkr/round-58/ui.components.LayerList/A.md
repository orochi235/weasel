I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the full document is below. One thing to know first: the brief's frozen commit `b400d7039e…` doesn't exist in this clone (`git cat-file` reports a bad object). I read HEAD `a22801b42b` instead, which has no local changes under `packages/ui/src/components/LayerList`.

# Audit round 58: ui.components.LayerList

## An open rename field that closes because of a hold, a lock or a removal leaves `renaming` set, so it reopens later and takes focus
- where: packages/ui/src/components/LayerList/RowParts.tsx:37 (RowLabel); the state is in packages/ui/src/components/LayerList/LayerList.tsx:31 (HeldLayerList)
- scenario: The user double-clicks "Sun" and the field opens (`renaming = 'sun'`). Before they press Enter or Escape or click away, one of these happens:
  - the list's `disabled` or `readOnly` turns on;
  - the app sets `locked: true` on Sun;
  - the app removes Sun.

  `RowLabel` now sees `renamable === false` and returns the plain span. `RenameField` unmounts without `finish` running, so `close()` is never called, and React sends no `onBlur` for a removed node. `renaming` stays `'sun'`.

  When the hold lifts, or the layer is unlocked or comes back through undo, `RenameField` mounts again with `autoFocus`. That opens a rename the user didn't ask for and pulls focus from wherever it was. It should count the field disappearing as the rename closing, by clearing `renaming` when the row stops being renamable or when the field unmounts.
- evidence: read
- severity: medium

## A locked layer's children can be moved out of it, though moves into it and among its children are refused
- where: packages/ui/src/components/LayerList/LayerList.tsx:51 (canDrop); packages/ui/src/components/LayerList/layerNodes.tsx:34 (immovable)
- scenario: Items `[{ id: 'g', locked: true, children: [g1, g2] }, b]` with `onReorder`.
  - `canDrop` refuses any target whose `parentId` is `'g'`, so g1 can't be reordered inside g and b can't be dropped in.
  - g1 itself is not `immovable`, because only `item.locked` is checked and not its ancestors. Dragging g1 below b, or pressing Alt+Left on it, produces `{ parentId: null }`. That passes `canDrop`, and `onReorder` moves g1 out of the locked group.

  This changes the locked layer's children, which the drop rule and the props doc ("The layer's content is locked … not dropped into") exist to prevent. g1 also still offers rename and remove. The two paths answer "can a locked layer's children change?" differently.
- evidence: read
- severity: medium

## A layer whose `children` is empty is drawn as a leaf, so an emptied group can never be dropped into again
- where: packages/ui/src/components/LayerList/layerNodes.tsx:36 (layerNodes)
- scenario: Items `[{ id: 'g', children: [{ id: 'g1' }] }, { id: 'b' }]`. The user drags g1 out, and `moveLayers` returns g with `children: []`.

  `layerNodes` passes `children` to the Tree node only when `item.children?.length` is truthy, so g becomes a leaf. Neither drop path works on a leaf:
  - `resolveDrop` offers `into` only for branch rows;
  - `keyboardTarget('in')` only works when the previous sibling has `children`.

  So neither a drag nor Alt+Right can put g1 or anything else back into g. `Tree` itself treats `children: []` as a branch, and a layer declared that way should stay a drop target.
- evidence: read
- severity: low

## The empty remove slot's width ignores `--wzl-button-h`, which the remove button's own width reads
- where: packages/ui/src/components/LayerList/LayerList.module.css:73 (.removeSlot)
- scenario: The remove button uses `CLOSE_BUTTON_PROPS` (`size: 'sm'`, `iconOnly`). Its width is `var(--btn-height)`, which is `var(--wzl-button-h, var(--wzl-control-h-sm))` (Button.module.css:117, 122).

  `.removeSlot` is the empty span a fixed, locked or non-removable row keeps so the columns line up. Its width is `var(--wzl-control-h-sm)` alone. If a theme or scope sets `--wzl-button-h`, every remove button ends up a different width from the slot. The visibility and lock columns of rows without a remove button then sit offset from rows with one, which is the misalignment b03ab7601f fixed.

  The width is decided in two places. The slot should use the same expression as the button.
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

<!-- done: 4 findings, files read: 11 -->