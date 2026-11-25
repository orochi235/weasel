# Audit round 87 — editing.actions findings

## makeBooleanGroup returns the group's id even when the scene refused the batch
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:83 (makeBooleanGroup)
- scenario: a container's arrival handler refuses the batch, so `scene.applyBatch` reverts it and returns false (`Scene.applyBatch` in packages/core/src/core/scene/types.ts:277). `makeBooleanGroup` ignores that return and still returns `made.group`, the id of a group that does not exist; a caller that selects or edits that id acts on nothing. Clone's commit checks the same return value (`commitClone`'s `apply`), so the two commit paths answer "did it land" differently. It should return null when `applyBatch` returns false.
- evidence: read
- severity: medium

## Rotate with pivot 'each' takes a selected derived group apart, where flip 'each' keeps it whole
- where: packages/editing/src/actions/rotate/session.ts:172 (captureTurn, `useUnionPivot`)
- scenario: select one group whose pose derives from its children (no `dependsOn`, so `derivedBoxOwner` is null) and rotate with `params.pivot: 'each'`, or replay a recorded `'each'` rotate on it. `shapeSources` expands the group to its children, `useUnionPivot` is false, and each child spins about its own center, so the group's layout breaks up. `flipOps` handles the same selection by mirroring the members about the group's own box (`ownPivot` for a `stoodIn` node). The same "per item" choice gets two different answers. 'each' should turn a selected group's sources about that group's center.
- evidence: read
- severity: medium

## A rotate behavior that returns a pose leaves gctx.current stale for the behaviors after it
- where: packages/editing/src/actions/rotate/frame.ts:82 (shapeDelta)
- scenario: behavior A returns `{ pose }` from `onMove`. `delta` and `proposed` are updated, but `syncGestureCurrent` is not called, while the `r.rotation` branch does call it. Behavior B, later in the chain on the same move, reads `gctx.current` for the selection at the earlier delta while `proposed.pose` shows the new one. Any behavior that reads the other nodes, such as a collision or bounds check, reasons about poses that will not be committed.
- evidence: read
- severity: low

## Lasso behaviors get no `plane` in their GestureContext, unlike every other gesture's behaviors
- where: packages/editing/src/actions/lassoSelect/action.ts:98 (start, `gesture` literal) and :140 (onMove)
- scenario: on a layer under a parallax or plane view, a `LassoSelectBehavior` reads `gctx.plane` and gets undefined, even though the lasso reads `readPlane()` for its own vertex spacing. Clone (`startCloneBehaviors`) and rotate (`buildGestureContext`/`shapeDelta`) set `plane` at start and refresh it on every move. A lasso behavior that converts screen tolerances or points through the plane works out a different answer from the action that hosts it.
- evidence: read
- severity: low

## Clone reports a commit when a behavior's answer is an empty op list
- where: packages/editing/src/actions/clone/action.ts:155 (commitClone)
- scenario: a clone behavior's `onEnd` returns `[]`. `commitClone` returns `{ committed: true, repeat: null }` without applying anything. `onEnd` then calls `forgetTransform(scene)`, which wipes Transform Again's memory of the previous transform, and runs `runBehaviorSettled(..., true)`, telling behaviors a commit happened. Nothing reached the document, so `committed` should be false and Transform Again's memory should be left alone.
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

<!-- done: 5 findings, files read: 35 -->
