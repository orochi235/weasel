# Findings: core.core.scene.part3

## staleReplay skips every per-node kit op on a removed node except `kit:setLod`, which throws instead
- where: packages/core/src/core/scene/staleReplay.ts:77-87 (stale)
- scenario: `scene.setLod(id, lod)` (recorded as `kit:setLod`, declaredFieldSetters.ts:48), then `scene.untracked(() => scene.remove(id))`, then `history.undo()`. Every sibling declared-field op (`kit:setUnits`, `kit:setClip`, `kit:setPage`, `kit:setPageRun`) and `kit:setHidden`/`kit:setLocked` is listed and skipped when its node is gone; `kit:setLod` falls to `default: return false`, so its revert runs `requireNode(id)` and throws. The undo is refused, the entry stays on top of the stack, and every entry beneath it is out of reach. That is exactly what the module says it exists to prevent. It should be listed with the other `{ id }` ops.
- evidence: read
- severity: medium

## `changesSince` leaves out the dependents of a node that left the scene, though their derived pose changed with it
- where: packages/core/src/core/scene/sceneTouches.ts:140-145 (reached)
- scenario: E is added with `dependsOn: [X]` while X is absent (allowed: "a declared dependency that appears later invalidates the node when it does"). Then `scene.add({ id: X, … })`, then `scene.undo()`. The undo reverts `kit:add`, which takes X out without cascading, and E stays. `noteOp` notes X as content. In `reached`, X is popped, `nodes.get(X)` is undefined, and the loop `continue`s before it reaches `env.dependents.transitiveDependentsOf(X)`. The index still holds E under X (dependents.ts:44-46: who depends on an id "outlives its removal"). So `changesSince(token).ids` is `{X}` without E. An index updating only those ids keeps E's bounds and paint as they were with X present, while E now derives without it. The dependents walk should run for an id whether or not it is still in `nodes`; only the children walk needs the node.
- evidence: read
- severity: medium

## Files read
packages/core/src/core/scene/renderOrder.ts
packages/core/src/core/scene/renderRank.ts
packages/core/src/core/scene/rigidFoldable.ts
packages/core/src/core/scene/sameValue.ts
packages/core/src/core/scene/scene.ts
packages/core/src/core/scene/sceneChanges.ts
packages/core/src/core/scene/sceneEdits.ts
packages/core/src/core/scene/sceneJournals.ts
packages/core/src/core/scene/sceneMutators.ts
packages/core/src/core/scene/scenePoseAdapter.ts
packages/core/src/core/scene/sceneRecording.ts
packages/core/src/core/scene/sceneRegistry.ts
packages/core/src/core/scene/sceneReplay.ts
packages/core/src/core/scene/sceneSelection.ts
packages/core/src/core/scene/sceneState.ts
packages/core/src/core/scene/sceneTouches.ts
packages/core/src/core/scene/scrollOffsets.ts
packages/core/src/core/scene/serialization.ts
packages/core/src/core/scene/serializedTypes.ts
packages/core/src/core/scene/sessionHost.ts
packages/core/src/core/scene/snapshotShape.ts
packages/core/src/core/scene/snapshotShapeError.ts
packages/core/src/core/scene/stackIndex.ts
packages/core/src/core/scene/staleReplay.ts
packages/core/src/core/scene/statedFields.ts
packages/core/src/core/scene/strategyView.ts
packages/core/src/core/scene/testing/makeScene.ts
packages/core/src/core/scene/touchJournal.ts
packages/core/src/core/scene/treeEdits.ts
packages/core/src/core/scene/treeOrder.ts
packages/core/src/core/scene/treeReads.ts
packages/core/src/core/scene/treeShape.ts
packages/core/src/core/scene/trivialScene.ts
packages/core/src/core/scene/types.ts
packages/core/src/core/scene/unionOfChildren.ts
packages/core/src/core/scene/unitScopes.ts
packages/core/src/core/scene/useEditingSession.ts
packages/core/src/core/scene/useScene.ts
packages/core/src/core/scene/useSceneOptions.ts
packages/core/src/core/scene/worldSave.ts

<!-- done: 2 findings, files read: 40 -->
