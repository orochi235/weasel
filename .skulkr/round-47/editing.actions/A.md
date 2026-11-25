# Audit round 47 — editing.actions

## Flip reads every node through the unspecialized pose descriptor, ignoring `forNode`
- where: packages/editing/src/actions/flip/action.ts:150 (flipOpsFor), :118–119 and :125 (flipOps)
- scenario: `flipOpsFor` passes `poseDescriptorOf(deps.poseDescriptor)` as one `geom` for every id, and `flipPoseAboutBounds`, `flipPoseViaDescriptor` and the `localMirror` fallback box all read through it. Rotate, clone and swap resolve each node's own descriptor through `nodeDescriptors(scene, …)` (`PoseDescriptor.forNode`, e.g. `pathMotion`'s specialization). For a host whose descriptor specializes per node, flip measures, remaps and re-rotates those nodes through the base descriptor: wrong bounds, or a `withRotation` or `remapBounds` that doesn't fit the node's pose shape. Flip should resolve per node as the other transforms do.
- evidence: read
- severity: medium

## flip's `enabled` throws when the dispatcher has operands but no scene
- where: packages/editing/src/actions/flip/action.ts:193 (flipAction.enabled)
- scenario: `requiresOperands` checks only `operands`; `enabled` then passes `deps!.scene!` to `flipOpsFor` → `withoutPageStructure(undefined, …)` throws when a host supplies a selection without a `scene` dep. The invoker guards `!scene` and returns, and align/distribute's `enabled` answer a reason; flip's should too.
- evidence: read
- severity: low

## Make Boolean Group does not strip page structure from the operands it groups
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:28 (booleanGroupOps), :95 (enabled)
- scenario: `enabled` gates on `requiresContent(2)`, which counts operands *without* page structure, and then on `rootsAmong(operands)` *with* it, and `booleanGroupOps` takes `rootsAmong(scene, ids)` over the raw ids. Select page A, a shape on page A and a shape on page B (or a host's selection api that fills in a page): content counts 2, `rootsAmong` gives [pageA, shapeB], and the op reparents the page node under a new boolean group (or, where layers differ, returns null so an enabled action does nothing). Every other scene action here (align, distribute, flip, delete) runs `withoutPageStructure` first; this one should too, before `rootsAmong`.
- evidence: read
- severity: medium

## The lasso's default commit and `selectFromLasso` answer a degenerate lasso differently
- where: packages/editing/src/actions/lassoSelect/action.ts:215 (endLasso) vs packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:43
- scenario: a lasso of three or more vertices along a near-straight line (AABB area < 4 world px²) clears the selection (or keeps it, with Shift) under `selectFromLasso`, the behavior documented as the lasso's own, but under the default commit it hit-tests the sliver and selects whatever it crosses. Same gesture, two answers depending on whether a behavior list was passed. One rule should decide both.
- evidence: read
- severity: low

## Clone's preview hands a singular-frame copy's `null` pose to the quantize rule, where rotate skips it
- where: packages/editing/src/actions/clone/action.ts:171 (show, in cloneAction.start)
- scenario: `landed()` returns `frame.local(...)`, which is `null` for a node whose parent frame is singular (its own doc says so, at :54). The preview loop asserts it with `!` and passes it to `quantizedPreview(scene, id, null)`. On a scene with a `quantize.stored` rule, that runs `storedOf(rule, { data, pose: null }, …)`, a rule written for a real pose, on every move. Rotate's `storedPreviews` (rotate/frame.ts:97) skips such a node ("left as it is"), and clone's own commit refuses it (`placedCopyOps` → null). The preview should skip it too.
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

<!-- done: 5 findings, files read: 34 -->
