I couldn't save the findings file. The first write worked, but every write after it was refused for lack of permission, so `.skulk/out/findings.md` holds only the first finding. Here is the full document:

# Audit round 41: core.core.scene.part3

## `loadState` runs with a journal open and leaves that journal holding the replaced document's ops
- where: packages/core/src/core/scene/scene.ts:192-206 (buildScene → loadState)
- scenario: open a journal with `scene.history.beginJournal(...)`, as a modality or edit session does, and make an edit so it holds `kit:setPose` on node `a`. Then call `scene.loadState(json)` with a snapshot that also has a node `a`. The only guard is `mode.open()`, and an open journal is not an edit driver (`editMode.ts`: batch/engine/untracked/own), so the load goes ahead. `recording.clearHistory()` is `engine.clear()`, which empties the undo/redo stacks and forks (`history.ts:103`, `forks.ts:125`) but never closes journals. `sceneJournals`' `opened` list also keeps the wrapper. The journal stays active, and later edits still go into it. `journal.cancel()` replays its reverts onto the loaded document; `staleReplay` skips only ids that are missing, so the loaded `a` takes the old pose. `journal.commit()` pushes pre-load entries onto the stack `loadState` just cleared, and undo then applies them to the new nodes. Expected: refuse a load while a journal is open, as the docs already say for other edits ("Throws inside any other edit … which would revert to a state this replaces"), or close the journals along with the history.
- evidence: read
- severity: medium

## A stale replay never skips a layer op, so an untracked layer edit leaves an undo entry that throws on every step
- where: packages/core/src/core/scene/staleReplay.ts:39-70 (createStaleReplay → stale)
- scenario: `scene.addLayer({ id: 'L', name: 'L' })`, then a recorded `scene.setLayerVisible('L', false)`, then `scene.untracked(() => scene.removeLayer('L'))`. The `batch` inside `untracked` records nothing. Undo now replays `kit:setLayerVisible`'s revert, which calls `requireLayerIndex('L')` (`layerOps.ts:26`) and throws. `stale()` has no case for `kit:setLayerVisible`, `kit:setLayerLocked`, `kit:setLayerParallax`, `kit:renameLayer` or `kit:moveLayer`, all of which name a layer by an id that can be gone. So it answers `false`: the entry is refused, stays on top, and every entry under it is out of reach. That is the outcome this module's header says it exists to prevent.
  - `kit:setLayer`: the case checks only that the node is there, not that the layer it writes still exists. Redoing a `setLayer` onto a layer an untracked `removeLayer` took throws the same way (`kitOps.ts:94`).
  - `kit:add`: the case checks only the id and the parent. A redo of an add whose layer was removed untracked puts the node in `nodes` on a layer `layerIndex` doesn't know, so no render-order walk ever shows it.
  - Expected: these are skipped the same way as a node op whose node is gone.
- evidence: read
- severity: medium

## A journal opened on `scene.history` records `applyOps` inside `untracked`, which the history facade refuses
- where: packages/core/src/core/scene/sceneJournals.ts:22-27 (wrapJournal → applyOps)
- scenario: `const j = scene.history.beginJournal({...}); scene.untracked(() => j.applyOps([op], 'x'))`. `historyFacade.ts:146-151` calls `refuseUntracked` before `apply`/`applyOps`, and `Scene.untracked`'s docs say it "throws on `applyBatch` and `history.apply` / `applyOps`, which exist to record". The wrapper's `applyOps` goes straight to `env.runArrivalEdit` → `raw.applyOps`, and never calls `env.refuseUntracked`, even though its `SceneHistoryEnv` provides it. So writes made inside `untracked` land in a recorded journal entry, and that one question gets two different answers depending on whether the caller holds the journal or the facade. Expected: the wrapper refuses the same way the facade does.
- evidence: read
- severity: low

## `reorder` with an omitted index treats it as "the end" in its no-op check and records "the start"
- where: packages/core/src/core/scene/treeEdits.ts:178-187 (createTreeEdits → reorder)
- scenario: a JS caller, or one passing an optional number through, calls `scene.reorder(id, undefined)` on a node that is not last. `staysPut` reads `index ?? last` (the end), but the payload records `slotIndex(index, …)`. `slotIndex(undefined, n)` is 0 because `undefined > 0` is false, so the node jumps to the front. Called on the last node, the same call is a no-op. `move` reads an omitted index as `Infinity` in both places, so the two tree edits answer "no index" differently. Expected: one reading of a missing index, the end as `move` has it.
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

<!-- done: 4 findings, files read: 38 -->