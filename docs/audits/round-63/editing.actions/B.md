# Audit round 63 — editing.actions

## A lasso's "tiny, so a click" threshold is a fixed 4 world px², so a real lasso when zoomed in, or a long straight one, clears the selection
- where: packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:16-21 (isTinyLasso), used by packages/editing/src/actions/lassoSelect/action.ts:214 (endLasso)
- scenario: (a) At zoom 100, the user lassos a 150×150 screen-px loop around several nodes: in world it spans 1.5×1.5 = 2.25 px² < `MIN_AREA` 4, so `endLasso` takes it for a click and runs `setSelection([])` — the nodes enclosed are not selected and the existing selection is wiped. (Worse, `DEFAULT_MIN_VERTEX_SPACING` is also 2 *world* px, so at that zoom the 150-px loop records at most one or two vertices and `vertices.length < 3` already fires.) (b) At any zoom, a 300-px horizontal lasso stroke across a row of nodes in `'intersect'` mode has a near-zero AABB height (area < 4) and clears the selection instead of taking what it crossed. The marquee rules the opposite way for the same gesture: `areaSelect.ts:94-99` treats only a zero-extent rect as a click, "one flat on a single axis still crosses what lies along it". Should be a screen-space threshold (or the marquee's rule), consistent between the two selection drags.
- evidence: read
- severity: medium

## Cut copies the clipboard dep's selection but deletes the `operands`, so with a host-supplied operand list the deleted nodes never reach the clipboard
- where: packages/editing/src/actions/clipboard/action.ts:55-62 (clipboardCutAction.invoker.run); also clipboardCopyAction:27-34
- scenario: A host supplies `operands` as a fixed list (`createOperandList([n1, n2])`, e.g. a context menu acting on nodes the selection doesn't name; `operands.ts` says this is what the dep is for). Cmd+X: `deleteEnabled` and `commitDeleteToScene` act on `deps.operands.get()` = [n1, n2], but `deps.clipboard.copy()` takes no ids and snapshots the clipboard's own `getSelection` (`useClipboardOps(adapter, { getSelection })`). So the clipboard gets the selection (empty, or other nodes) while n1 and n2 are deleted. Cut throws the content away, and a later paste brings back the wrong nodes. Copy has the same split: it is gated by `requiresOperands` but copies the selection. The copy should snapshot the same ids the delete removes.
- evidence: read (`ClipboardDep.copy(): void` in packages/core/src/interactions/actions/editDeps.ts:15; `OperandsDep` docs in packages/core/src/interactions/actions/operands.ts:1-16)
- severity: medium

## Pathfinder actions gate on `operands` but run on the booleans adapter's own selection
- where: packages/editing/src/actions/pathfinder/action.tsx:86-91 (makePathfinderAction.enabled), 68-73 (run)
- scenario: `enabled` first requires `deps.operands.get().length >= 2`, then counts operands over `adapter.getSelection()`. `run` and `preview` call `applyBooleanOp` and `previewBooleanOp`, which read `adapter.getSelection()` (booleans.ts:207, 232). With operands supplied as a list other than the selection, the action can be disabled although the selection holds two shapes (when the operands are fewer than two), and when it is enabled it unites the selection rather than the operands. It is the same edit acting on two different id sources. The neighboring `makeBooleanGroupAction` reads `operands` throughout.
- evidence: read
- severity: low

## Rotate with `pivot: 'each'` takes a selected derived-pose group apart: each child turns about its own center, while Flip `'each'` treats the group as one item
- where: packages/editing/src/actions/rotate/session.ts:145-155 (captureTurn), via frame.ts:29-36 (turnedWorlds)
- scenario: Select a group G whose pose derives from its children c1, c2 (`dependsOn: 'children'`), plus a rect R, and rotate 90° with `params.pivot: 'each'`, or Transform Again replaying a recorded `pivot: 'each'` through rotate/replay.ts. `ids = shapeSources(...)` = [c1, c2, R]. `derivedBoxOwner` is null because two nodes are selected, so `useUnionPivot` is false and `turnedWorlds` turns c1 and c2 each about its own center. G's layout is scrambled instead of G turning about G's center. Flip resolves the same question the other way: flip/action.ts:77-90 pivots a stood-in group's members on the group's own box ("about the group's own box where each selected node flips in place"). In `'each'` mode the unit should be each selected node, with a group's members orbiting that group's center.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/align/action.tsx
packages/editing/src/actions/align/align.ts
packages/editing/src/actions/align/index.ts
packages/editing/src/actions/clipboard/action.ts
packages/editing/src/actions/clone/action.ts
packages/editing/src/actions/clone/behaviors.ts
packages/editing/src/actions/delete/delete.ts
packages/editing/src/actions/derivedBox.ts
packages/editing/src/actions/distribute/action.tsx
packages/editing/src/actions/distribute/distribute.ts
packages/editing/src/actions/distribute/index.ts
packages/editing/src/actions/distribute/plan.ts
packages/editing/src/actions/flip/action.ts
packages/editing/src/actions/flip/helpers.ts
packages/editing/src/actions/group/enterGroup.ts
packages/editing/src/actions/lassoSelect/action.ts
packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts
packages/editing/src/actions/lassoSelect/index.ts
packages/editing/src/actions/lassoSelect/options.ts
packages/editing/src/actions/lockedWrites.ts
packages/editing/src/actions/pathfinder/action.tsx
packages/editing/src/actions/pathfinder/booleanGroupAction.ts
packages/editing/src/actions/pathfinder/keymap.ts
packages/editing/src/actions/reorder/reorder.ts
packages/editing/src/actions/rotate/action.ts
packages/editing/src/actions/rotate/commit.ts
packages/editing/src/actions/rotate/frame.ts
packages/editing/src/actions/rotate/replay.ts
packages/editing/src/actions/rotate/session.ts
packages/editing/src/actions/select/areaSelect.ts
packages/editing/src/actions/select/clearSelection.ts
packages/editing/src/actions/swap/action.ts
packages/editing/src/actions/swap/swapOps.ts
packages/editing/src/actions/transformAgain/action.ts
packages/editing/src/actions/transformAgain/transformSelection.ts

<!-- done: 4 findings, files read: 35 -->
