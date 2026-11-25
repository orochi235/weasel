## Lasso's "tiny lasso" and vertex-spacing thresholds are in world units, so a deep zoom turns a real lasso into a click
- where: packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:20 (isTinyLasso, MIN_AREA = 4); packages/editing/src/actions/lassoSelect/action.ts:69 (DEFAULT_MIN_VERTEX_SPACING = 2 world-px)
- scenario: at 100× zoom the user drags a 150×150 screen-px loop around a 1×1 world-unit node. The polygon's AABB is 1.5×1.5 = 2.25 world px² < 4, so `endLasso` takes the `isTinyLasso` branch and clears the selection (or keeps it with Shift) instead of selecting the node. The same zoom makes the 2 world-px vertex spacing 200 screen px, so the recorded polygon is a coarse few-vertex shape that drops nodes the drawn loop enclosed. Both should be screen-space thresholds (scale by `view.get().scale`); at low zoom the inverse happens (a 1 screen-px jiggle at 0.1× is 10 world px and is not a click).
- evidence: read
- severity: medium

## A flat lasso clears the selection where a flat marquee selects what it crosses — the same "is this a click" decision answered two ways
- where: packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:20 (isTinyLasso) vs packages/editing/src/actions/select/areaSelect.ts:107 (onEnd)
- scenario: a lasso dragged as a straight horizontal stroke across three shapes (mode `'intersect'`) has AABB area 0 → `isTinyLasso` → selection cleared. A marquee dragged along the same line has width > 0, height 0, and `areaSelect` deliberately keeps it ("One flat on a single axis still crosses what lies along it") and selects the three shapes. The lasso path (default commit and `selectFromLasso`) should apply the same rule: only a zero-extent gesture is a click.
- evidence: read
- severity: low

## Pathfinder `enabled` gates on `operands` but counts operands from the booleans adapter's own selection
- where: packages/editing/src/actions/pathfinder/action.tsx:84 (makePathfinderAction enabled)
- scenario: `ids.length < 2` reads `deps.operands`, while the count that decides enablement (and the run, via `applyBooleanOp(adapter, …)`) reads `adapter.getSelection()`. Where the two differ (operands narrowed by the entered group or a host-supplied operands dep, while the adapter reads the raw selection), the action can be enabled by one set and operate on another, or report SelectionRequired while the adapter holds two operands. One source should answer both.
- evidence: read (operands/adapter divergence inferred, not traced)
- severity: low

## Clone records a plain `duplicate` of the drag delta even when a behavior placed the copies elsewhere
- where: packages/editing/src/actions/clone/action.ts:229 (onEnd → recordTransform)
- scenario: a clone behavior answers `copyOps(placement)` with a placement that reparents the copies into a container at a new pose (`placementShift` ≠ 0). The commit succeeds, and `recordTransform(scene, { kind: 'duplicate', dx, dy }, …)` records the raw drag delta. Transform Again then duplicates the copies by `(dx, dy)` from where they now sit, not by the offset they actually moved, so step-and-repeat diverges from what the user did. Likewise when the behavior returns ops of its own that make no copies, a `duplicate` is still recorded.
- evidence: read
- severity: low

## `transformSelection` checks locks on the unfinished batch, while `enabled` checks the followers' finished batch
- where: packages/editing/src/actions/transformAgain/transformSelection.ts:50 (transformSelection); packages/editing/src/actions/transformAgain/action.ts:36 (replay)
- scenario: a move whose transform followers rewrite a locked node (a connector or path effect following the moved node). `selectionTransformAnswer` runs `finishTransformOps` and answers Locked, but `transformSelection` — callable directly by other actions, without going through that answer — only runs `writesLocked(scene, ops)` on the unfinished ops, passes, and hands the batch to `commitTransformOps`, whose finished batch the scene's lock guard refuses (it throws `cannot … it is locked`). The guard should run on the same finished batch `enabled` inspects.
- evidence: read (guard throw from packages/core/src/core/scene/lockGuard.ts; whether commitTransformOps catches it not traced)
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

<!-- done: 5 findings, files read: 35 -->
