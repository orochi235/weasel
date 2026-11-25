## Stale-replay check for `kit:setLayer` ignores the layer floor, so a replay after an untracked reparent can leave a child on a layer below its parent
- where: packages/core/src/core/scene/staleReplay.ts:80 (createStaleReplay → stale, case 'kit:setLayer')
- scenario: Layers `background < structures < plantings`. Root B is on `plantings`, and `scene.setLayer(B, 'background')` is recorded, which is legal because B is a root. Then `undo()` puts B back on `plantings`. Inside `untracked`, `move(B, P)` with P on `plantings` is legal, since B's layer is not below P's. Then `redo()`: `stale('kit:setLayer', …, forward)` only checks `nodes.has(p.id)` and `layers.has(p.to)`, so the op replays and B ends up on `background` under P on `plantings`. That is the cross-layer subtree `setLayer`/`move`/`add` all refuse, and `loadScene` throws on it ("invalid scene shape (cross-layer subtrees)"), so the scene's own `toJSON()` stops loading. The `kit:move`, `kit:add` and `kit:remove` cases check placement with `fits`. This case should check it too: the node's new layer against its current parent's, and each child's against the new layer. The same gap applies in reverse when an undo raises a parent above a child that an untracked move put under it.
- evidence: read (staleReplay.ts:47-53 `fits` and its use at 63/70/78, against 80-83; fieldEdits.ts:75-78 `assertSubtreeLayer` on the live path)
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

<!-- done: 1 findings, files read: 40 -->
