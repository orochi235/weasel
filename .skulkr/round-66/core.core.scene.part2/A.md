# Audit round 66 — core.core.scene.part2

## A path effect's cached result ignores the node-memo generation, so a painter change leaves it showing the old outline
- where: packages/core/src/core/scene/pathEffects/derive.ts:100 (current) / :67 (results cache)
- scenario: a path effect (roughen, tween, bendAlong…) over a source whose outline comes from its kind's painter. A painter for that kind is registered, replaced (hot reload) or released after the effect first derived: `nodeShapesChanged()` calls `bumpNodeMemoGeneration()` so every `nodeMemo` slot (including the scene memo around `derivePath`) recomputes, and the source repaints with its new outline. The effect's derivation is called again, but `current()` compares only data, dep nodes, poses, dep paths, inherited and the outside generation — none of which moved (a painter without `geometryGeneration` never counts toward `outsideGeneration`) — so it returns the held result read through the old painter. The effect stays drawn, picked and bounded from the stale outline until some dependency is edited. `current()` should also hold `nodeMemoGeneration()` as of the derive and miss when it moved, which is exactly the signal nodeMemo's doc names for ambient state like "a registry".
- evidence: read (nodeShapeRegistry.ts:73 `nodeShapesChanged` bumps only the nodeMemo generation and emits)
- severity: medium

## reconcileSpecs retargets a path effect's `foundHidden` a second time when `next` changes both its data and its `dependsOn`
- where: packages/core/src/core/scene/reconcileSpecs.ts:67-68 (reconcileSpecs)
- scenario: prev spec `{ dependsOn: ['a','b'], data: { pathEffect: { kind:'tween', hideSources:true, foundHidden:[1] } } }` (b was already hidden); next spec swaps the sources and states the data that goes with them: `{ dependsOn: ['b','a'], data: { pathEffect: { …, foundHidden:[0] } } }`. Line 67 writes `spec.data` (foundHidden [0], already in the new order), then line 68 calls `scene.setDependsOn(id, ['b','a'])`, which (fieldEdits.ts:100) runs `foundHiddenRetargeted(node.data, ['a','b'], ['b','a'])` on the data just written: it reads position 0 of the *old* list (`a`) and moves it to `a`'s new position, giving `foundHidden: [1]`. The node ends up saying `a` was found hidden and `b` was not, so when the effect goes `b` is unhidden and `a` is left hidden — the opposite of what `next` stated. Setting `dependsOn` before the data (or writing `spec.data` after the retarget) keeps the spec's own record.
- evidence: read (fieldEdits.ts:100-105)
- severity: low

## The pose feed misses an override pose mutated in place, which is the override table's documented frame shape
- where: packages/core/src/core/scene/poseFeed.ts:104 (touched) and :68 (walk)
- scenario: a frame loop hoists one `PoseOverride` entry with a pose buffer, `overrides.set(id, entry)` once, then each frame writes `entry.pose.x = …` and calls `overrides.commit()` (the shape `PoseOverride`'s and `PoseOverrides`' docs describe, and the one `dropPoseKeyedMemoSlots` exists for). `commit` moves the table's generation, so `changesSince` names the id and the feed's `read()` reaches `touched`; but `effectivePose` answers the same pose object as last read, so `before.pose !== pose` is false and the node is reported in neither `added` nor `changed`. A host driving its renderer off the feed (kernel3d-style) never moves the node for the whole animation; only a frame that replaces the pose reference shows. The snapshot should hold a value copy (`snapshotPose`/`samePoseValue`, as `pathEffects/derive.ts` does for the same reason) or treat an override-touched id as changed.
- evidence: read (effectivePose.ts:326 returns the override's pose by reference)
- severity: medium

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

<!-- done: 3 findings, files read: 40 -->
