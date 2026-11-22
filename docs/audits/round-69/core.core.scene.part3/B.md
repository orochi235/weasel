# Audit round 69 — core.core.scene.part3

## A redo or undo of `kit:move` after an untracked edit can create a cycle and drop a subtree from the document, because stale-replay does not check for a cycle or the layer floor
- where: packages/core/src/core/scene/staleReplay.ts:56 (createStaleReplay → stale, case 'kit:move'); also 'kit:add' at :46 and 'kit:setLayer' at :60
- scenario: roots A and B. `scene.move(A, B)` is recorded, then `undo()` puts A back at the root. Next, `scene.untracked(() => scene.move(B, A))` puts B under A without the history hearing of it. `redo()` then replays `kit:move {id: A, toParent: B}`. `stale` checks only that A exists and that B exists (`holds(p.toParent)`), so the op is not skipped. `movesNode` detaches A from the roots and attaches it under B, which is A's own child, so A→B→A is a cycle. Neither node can be reached from `roots` any more. They disappear from `renderOrder`, picking and `toJSON` (`treePreorder` walks only from roots), and `ancestorsOf(A)` loops forever. The same gap exists for the layer floor: after an untracked `setLayer(B, <higher layer>)`, redoing a move or add of A under B puts a child below its parent's layer, which `move`/`add` refuse. The file's own rule is that an op whose target is not where its entry left it is skipped, and these ops should be too.
- evidence: read (staleReplay.ts `stale`; kitOps.ts `movesNode` has no cycle or layer check; treeEdits.ts `move` does both checks only on the live path)
- severity: medium

## In `kit:add`'s revert, the touched-ids feed notes the parent from the payload, not the parent the node actually leaves
- where: packages/core/src/core/scene/sceneTouches.ts:80 (createSceneTouches → noteOp, case 'kit:add')
- scenario: `add({id: X, parent: P})` is recorded. `untracked(() => move(X, Q))` moves it (the feed notes Q then). `undo()` reverts the add, which detaches X from Q. `noteOp` notes `p.parent` (P) with TOUCH_CHILDREN, not Q. A reader of `changesSince` gets `parents` = {P}, keeps Q's cached child list, and still holds X under Q. Reverts of `kit:move` and `kit:remove` have the same reliance on payload parents. Only an untracked reparent between record and replay triggers it.
- evidence: read
- severity: low

## `loadState` trims an `EditingSession`'s selection without telling its subscribers
- where: packages/core/src/core/scene/sessionHost.ts:122 (keepLegal), called from packages/core/src/core/scene/scene.ts:232 (loadState)
- scenario: an `EditingSession` over a scene has [a, b] selected. `scene.loadState(json)` loads a snapshot without `a`. `keepLegal` uses `selection.replace`, which tells no one. The session's selection now reads [b], but its subscribers (a panel subscribed through the session's selection) are never notified. The scene's own selection is covered by the scene's one `notify()`; another session's selection announces only through its own emitter, which never fires here. `types.ts` promises that "Selected ids the snapshot does not hold leave the selection".
- evidence: read (sceneSelection.ts `replace` does not emit; sessionHost.ts `open` builds sessions whose selection announces only on `set`)
- severity: low

## `sceneMutators.setChildOrder` reorders ids under a different parent when the list names a node that is not a child of `parentId`
- where: packages/core/src/core/scene/sceneMutators.ts:56 (setChildOrder)
- scenario: `setChildOrder('P', ['c1', 'x'])` where `x` lives under Q. In the loop, `getChildren('P')[1] !== 'x'`, so it calls `scene.reorder('x', 1)`. That moves x to index 1 among Q's children, which is a silent edit to an unrelated container, recorded in the 'Reorder' batch. It should refuse the id, or reparent it.
- evidence: read
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

<!-- done: 4 findings, files read: 40 -->
