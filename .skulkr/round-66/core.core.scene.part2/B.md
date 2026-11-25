# Findings: core.core.scene.part2

## Undoing an unhide or unlock re-hides/re-locks a node without dropping it from the selection
- where: packages/core/src/core/scene/nodeFlags.ts:49-55 (createNodeFlags, `revert`)
- scenario: node `a` is hidden; `setHidden('a', false)`, select `a`, then undo. `revert` writes `hidden: true` back but never calls `narrowSelection()` (only `apply` does, and only when `to` is true), so the selection keeps a hidden node, which `LockGuard.reachable` documents the selection never holds. Same for `setLocked(a, false)` → select → undo: the selection keeps a locked node and a following edit through it throws. Revert should narrow when `from` is true, as apply does when `to` is.
- evidence: read
- severity: medium

## Same for layer visibility/lock: reverting `kit:setLayerVisible`/`kit:setLayerLocked` never narrows the selection
- where: packages/core/src/core/scene/nodeFlags.ts:49 (the per-node twin; layer twin at layerOps.ts:35,40 is outside the list) — noted here because nodeFlags copies the pattern
- scenario: see above; the node-flag case is the in-area instance.
- evidence: read
- severity: low

## The pose feed misses a pose override that mutates its pose buffer in place
- where: packages/core/src/core/scene/poseFeed.ts:65-68, 101-104 (walk, touched)
- scenario: a frame loop holds one override entry and mutates `entry.pose.x` each frame, then `commit()`s — the pattern `PoseOverride`'s doc and `dropPoseKeyedMemoSlots` describe. `changesSince` names the id (the overrides' generation moved), but `effectivePose` returns the same pose object as last read, and the feed stores that same reference in `seen`, so `before.pose !== pose` is false and the node is never reported in `changed`. A renderer driven by the feed never sees the animation. The feed should snapshot (`snapshotPose`) and compare by value (`samePoseValue`), as `pathEffects/derive.ts` does for the same reason.
- evidence: read
- severity: medium

## Under `muted`, settled callbacks run before the subscribers hear of the change
- where: packages/core/src/core/scene/notifier.ts:66-76 (muted)
- scenario: `engineDriven` (an undo/redo through a history engine) runs inside `muted`; an op in it causes a `whenSettled` notice (the scene's overrides table emits through it, `poseOverrides.ts:61`). When `muted` is the outermost holder, its `finally` calls `flush()` at once, so that notice reaches overrides listeners before the caller's own `notify()` reaches the scene's subscribers. `whenSettled`'s contract is "after the subscribers it notifies", so an overrides listener re-reading the scene runs ahead of everyone keyed on the scene's version. `muted` should leave the settled set for the caller's notify, or flush after it.
- evidence: read
- severity: low

## `reconcileSpecs` brings back a node the scene deleted when its spec did not change
- where: packages/core/src/core/scene/reconcileSpecs.ts:54-56 (reconcileSpecs)
- scenario: prev and next both hold spec `a`, unchanged; between them the user deleted `a` in the scene. The loop's `scene.get(id) === undefined` branch re-adds `a` from `next`. The doc promises a diff of spec against spec, so "whatever the scene did since `prev` … survives unless `next` changes that same field"; instead, every reconcile undoes a deletion made in the scene. An unchanged spec whose node is gone (and was not removed by this pass's own `removing`) should stay gone.
- evidence: read
- severity: low

## Files read
packages/core/src/core/scene/layoutPass.ts
packages/core/src/core/scene/layoutTypes.ts
packages/core/src/core/scene/lockGuard.ts
packages/core/src/core/scene/minSize.ts
packages/core/src/core/scene/nestedHit.ts
packages/core/src/core/scene/nodeAsShown.ts
packages/core/src/core/scene/nodeFlags.ts
packages/core/src/core/scene/nodeFnFields.ts
packages/core/src/core/scene/nodeFnTypes.ts
packages/core/src/core/scene/nodeGates.ts
packages/core/src/core/scene/nodeMemo.ts
packages/core/src/core/scene/nodeStore.ts
packages/core/src/core/scene/nodeTypes.ts
packages/core/src/core/scene/notifier.ts
packages/core/src/core/scene/opTable.ts
packages/core/src/core/scene/outerOps.ts
packages/core/src/core/scene/outputGrid.ts
packages/core/src/core/scene/outsideReads.ts
packages/core/src/core/scene/owned.ts
packages/core/src/core/scene/pathEffects/derive.ts
packages/core/src/core/scene/pathEffects/effects.ts
packages/core/src/core/scene/pathEffects/foundHidden.ts
packages/core/src/core/scene/pathEffects/index.ts
packages/core/src/core/scene/pathEffects/source.ts
packages/core/src/core/scene/pathEffects/textAlong.ts
packages/core/src/core/scene/pathEffects/textAlongBands.ts
packages/core/src/core/scene/pathEffects/tween.ts
packages/core/src/core/scene/plyStacks.ts
packages/core/src/core/scene/poseFeed.ts
packages/core/src/core/scene/poseHold.ts
packages/core/src/core/scene/poseOverrideTypes.ts
packages/core/src/core/scene/poseOverrides.ts
packages/core/src/core/scene/posePlies.ts
packages/core/src/core/scene/poseRemovals.ts
packages/core/src/core/scene/poseSnapshot.ts
packages/core/src/core/scene/poseWrites.ts
packages/core/src/core/scene/reconcileSpecs.ts
packages/core/src/core/scene/recorder.ts
packages/core/src/core/scene/registeredOp.ts
packages/core/src/core/scene/renderOrder.ts

<!-- done: 5 findings, files read: 40 -->
