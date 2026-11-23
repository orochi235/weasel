# Audit round 74 — core.core.scene.part2 findings

## A remove and re-add within one change reports a pose write from the shown (override) pose to the stored pose
- where: packages/core/src/core/scene/poseWrites.ts:154 (noteAdded), with packages/core/src/core/scene/poseRemovals.ts:117 (takeBack)
- scenario: a node is showing a pose override (a drag preview, a layout hold) and one change removes it and brings it back: a `kit:remove` reverted by a throwing batch's rollback, or a batch that removes and re-adds it. `seeOff` records the removal at `env.shown(id).pose`, which includes the override. Then `noteAdded` sets `from: removals.takeBack(id)` (that shown pose) and `to: n.pose` (the stored pose). The stored pose never changed, but `flush`'s `deepEqual(from, to)` sees two different values and `onPoseWrite` gets a write. What should happen: `from` is the stored pose the node had before the change, so a node that came back unchanged is left out, as the interface promises ("A node written back to the pose it had … is left out").
- evidence: read (traced both paths; not run)
- severity: low

## `createNestedHitTester` returns nodes marked `pickable: false`, and loops forever on a parent cycle
- where: packages/core/src/core/scene/nestedHit.ts:63 (hitLeaf), :52 (ancestorChain)
- scenario: the adapter's nodes include a box holding a label with `pickable: false`. `NodeBase.pickable` says "`false` makes it transparent to picking". But `hitLeaf` only skips `isGroup` nodes, so a click on the label returns the label. An alt-click `pickBest` then steps into it and selects the label, where it should land on the box. Separately, `ancestorChain` climbs `getParent` with no cycle guard, so a parent cycle hangs the pick. `nodeGates`' climbs guard against cycles, so that input is one the code elsewhere expects.
- evidence: read
- severity: low

## `OpTable.handlers` doc says re-registering a kind replaces it; `register` throws
- where: packages/core/src/core/scene/opTable.ts:31 (OpTable.handlers doc) vs :113 (register)
- scenario: a caller registers kind `k` with handler A, then with handler B, trusting the `handlers` doc: "a kind registered again replaces the handler before". `register` throws `ExtensionConflictError` unless `{ replace: true }` is passed, as the `register` doc beside it says. The two comments on one interface answer the same question two ways.
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
packages/core/src/core/scene/nodeLod.ts
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

<!-- done: 3 findings, files read: 40 -->
