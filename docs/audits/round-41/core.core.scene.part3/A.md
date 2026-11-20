# Audit round 41 — core.core.scene.part3

## `heldIndex` does not truncate a fractional index, so `moveLayer` to its own slot records an undo entry
- where: packages/core/src/core/scene/stackIndex.ts:6 (heldIndex); consumed at packages/core/src/core/scene/layerStack.ts:207-213 (moveLayer)
- scenario: layers `[a, b, c]`, `scene.moveLayer('a', 0.5)`. `heldIndex(0.5, 2)` returns `0.5`; `from (0) !== to (0.5)`, so the no-op check misses, `proposed.splice(0.5, 0, rec)` puts `a` back at 0, and `kit:moveLayer { from: 0, to: 0.5 }` is recorded: an undo entry that changes nothing (and a payload `to` that is not an index). Same for `moveLayer('b', 1.5)`. The tree's own index helper `slotIndex` (treeOrder.ts:25) truncates, so `reorder`/`move` with 0.5 elide correctly; the two index rules answer the same question two ways, and unruled.md (round ten) states a move to its own slot records nothing. Should be `Math.trunc` before clamping (pageEdits' `movePage` uses the same helper).
- evidence: read
- severity: low

## `freshIds` only steps over ids live in the document, so a minted id can collide with a node a restored history will bring back
- where: packages/core/src/core/scene/scene.ts:49-57 (freshIds), used at :132
- scenario: a consumer `generateId` that restarts with the session (the case the comment names), a document saved with `toJSON` plus its history saved with `serializeHistory`, both restored (`loadScene` + `restoreHistory`). A node removed in that history (id `n3`) is not in `state.nodes`, so `taken('n3')` is false and `add` mints `n3`. Undoing the restored removal now finds `n3` present; `staleReplay` (staleReplay.ts:47) skips the `kit:remove` inverse silently, so the removed node can never be brought back by undo. The guard should also treat ids the history's entries name as taken (or the collision should surface). With the default generator the random suffix makes this unlikely, so it bites only consumer generators.
- evidence: read (traced; not run)
- severity: low

## A journal's `applyOps` records inside `scene.untracked`, where `scene.history.applyOps` throws
- where: packages/core/src/core/scene/sceneJournals.ts:22-27 (wrapJournal → applyOps)
- scenario: `const j = scene.history.beginJournal({...}); scene.untracked(() => j.applyOps([op], 'x'))`. The facade's `history.applyOps` and `history.apply` call `refuseUntracked` first (historyFacade.ts:146-151) and `applyBatch` does too (sceneRecording.ts:160), as `Scene.untracked`'s contract says ("throws on `applyBatch` and `history.apply` / `applyOps`, which exist to record"). The wrapped journal's `applyOps` goes straight to `env.labeled(… runArrivalEdit …)` with no such check, so the same call through the journal handle records an entry into the journal from inside `untracked`, the case the scene refuses everywhere else. The one decision is answered two ways depending on which handle the caller holds; the wrapper should call `env.refuseUntracked('journal.applyOps')`.
- evidence: read
- severity: low

## An edit that is refused or throws after `kit:remove` applied leaves the removed nodes' scroll offsets and pose previews dropped
- where: packages/core/src/core/scene/sessionHost.ts:108 (forget), reached from kitOps.ts:242 via sceneEdits.ts:72
- scenario: a container `c` scrolled by `{x: 0, y: 200}` in a session (`scene.scroll.set(c, …)`); `scene.removeMany([c, …])` inside a `batch` whose later step throws, or a removal the arrival handler refuses (`SceneArrivalRefused`). `kit:remove`'s apply calls `forgetViewState` for every node first, which runs `scroll.set(id, null)` and `overrides.clear(id)` in every session; the edit is then reverted by the applied log and the nodes come back, but view state is not part of what the revert restores, so `c` reappears unscrolled and any preview on it is gone, though the edit never happened. The scroll emit also fires at once, mid-edit, rather than through `whenSettled` as overrides do. Forgetting should happen once the removal has landed (or be undone with it).
- evidence: read (traced; not run)
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
