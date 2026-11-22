# Audit round 70 — core.core.scene.part3

## A replayed `kit:setLayer` is never skipped for breaking the layer floor, so undo/redo after an untracked reparent puts a child below its parent's layer
- where: packages/core/src/core/scene/staleReplay.ts:80 (stale, case 'kit:setLayer')
- scenario: root node A is on `structures`; `scene.setLayer(A, 'plantings')` is recorded. Then, inside `untracked`, a group P is added on `plantings` and A is moved under it (allowed, since A's layer equals P's). `scene.undo()` replays `kit:setLayer`'s revert. `stale` only checks that A and the `from` layer exist, so the op runs and A lands on `structures` under a parent on `plantings`. A child now renders below its parent, which `setLayer`/`move`/`add` refuse (types.ts "Layer floor"); `renderOrder` paints A in the lower bucket, under P. The other direction fails the same way: record `setLayer(G, 'plantings')` on a childless G, undo it, add a child C on `structures` under G untracked, then redo: G goes above C. The `kit:add`, `kit:remove` and `kit:move` cases all guard this with `fits(...)`; `kit:setLayer` should skip when the target layer is below the parent's, or above any child's.
- evidence: read (staleReplay.ts:47-53, 75-83; kitOps.ts:85-103, where apply and revert write the layer with no floor check)
- severity: medium

## `Scene.childrenOf`'s doc says a mark has no children, but marks can hold children and `childrenOf` returns them
- where: packages/core/src/core/scene/types.ts:109 (Scene.childrenOf doc)
- scenario: `scene.add({ kind: 'mark', ... })`, then `scene.add({ kind: 'mark', parent: markId, ... })`. Nothing refuses a mark as a parent (treeEdits.ts addPayload/move check only the layer, locks and cycles), and `MarkNode` is documented as "It may still hold children" (nodeTypes.ts:115). `childrenOf(markId)` then returns `[childId]` (treeReads.ts:26-29), not the "empty for a mark" the public doc promises. A consumer who skips marks when walking the tree, because the doc says they have no children, misses that subtree.
- evidence: read
- severity: low

## `foldable` checks a version 1–2 save after its poses were already localized, so NaN poses can get past the guard it exists for
- where: packages/core/src/core/scene/scene.ts:224 and :271 (loadState, loadScene), with packages/core/src/core/scene/rigidFoldable.ts:14 (foldable)
- scenario: `loadScene(v2Save)` with no `composition`, where a child's pose has `width`/`height` but no `x`/`y`, e.g. `{ cx, cy, width, height }`, under a rect container. `specsFromSerialized` first localizes the world poses with `RIGID_POSE_COMPOSITION` (serialization.ts:157), and `decomposeRigidPose` returns `{ ...world, x: NaN, y: NaN }` (composePose.ts:132). `foldable` only runs after that. Its `isRect` asks only `typeof x === 'number'`, which NaN passes, so the load succeeds and the node holds `x: NaN, y: NaN`. That is exactly the "read back with `NaN` in it" that `foldable`'s doc says it throws on. A version 3 save with the same pose is not localized, so it does throw. The guard should look at the specs before localizing, or reject non-finite values.
- evidence: read (inferred from the code path; not run)
- severity: low

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

<!-- done: 3 findings, files read: 40 -->
