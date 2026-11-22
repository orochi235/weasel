# Audit round 70 — core.core.scene.part1

## `kit:add`'s revert takes the node out of the scene without narrowing any session's selection
- where: packages/core/src/core/scene/kitOps.ts:222 (registerAdd, revert)
- scenario: a node is added, then selected in a second `EditingSession` (or in the scene while a session makes the undo). Undoing the add runs `kit:add`'s revert, which detaches and deletes the node and calls `forgetViewState`, but never calls `env.narrowSelection`. Undo restores only the *acting* session's selection (per `scene.nodeFlags.test.ts:105`, "another session's has only the narrowing to keep it legal"), so the other session's selection keeps an id the scene no longer holds. Its readers then call `scene.get(id)` and get `undefined`, or act on the gone id. `kit:remove`'s apply, the other op that deletes nodes, does call `narrowSelection(new Set(ids))`, and `EditingSession`'s contract says "A removed, hidden or locked node leaves every session's selection". So the same question, whether removing a node narrows selections, gets two answers. It should call `env.narrowSelection(new Set([p.id]))`.
- evidence: read
- severity: medium

## `kit:setLayer`'s revert can put a node back on a hidden layer and leave it selected in other sessions
- where: packages/core/src/core/scene/kitOps.ts:99 (registerSetLayer, revert)
- scenario: node `n` is on hidden layer `H`. `scene.setLayer(n, 'V')` moves it onto visible `V`, and `apply` narrows. A second session then selects `n`. Undo runs the revert, which puts `n` back on `H` but does not narrow. The other session's selection keeps a node on a hidden layer, which the selection contract says is out of reach. Every sibling op that can put a node out of reach narrows on both halves: `kit:setLayerVisible` and `kit:setLayerLocked` (`layerOps.ts:35`, `:40`), the node `hidden`/`locked` flags (`nodeFlags.ts:58`), and `kit:move` (`relocate` narrows either way). `kit:setLayer` narrows only on apply.
- evidence: read
- severity: low

## Files read
packages/core/src/core/scene/NodeProperties.ts
packages/core/src/core/scene/NodeRouting.ts
packages/core/src/core/scene/annotation.ts
packages/core/src/core/scene/anyScene.ts
packages/core/src/core/scene/appliedLog.ts
packages/core/src/core/scene/arrivalTypes.ts
packages/core/src/core/scene/arrivalWindow.ts
packages/core/src/core/scene/arrivals.ts
packages/core/src/core/scene/booleanGroup.ts
packages/core/src/core/scene/booleanOfChildren.ts
packages/core/src/core/scene/boundOps.ts
packages/core/src/core/scene/carryDescendants.ts
packages/core/src/core/scene/clipNothing.ts
packages/core/src/core/scene/composeFrame.ts
packages/core/src/core/scene/composePose.ts
packages/core/src/core/scene/declaredFieldSetters.ts
packages/core/src/core/scene/depFrame.ts
packages/core/src/core/scene/depMemo.ts
packages/core/src/core/scene/dependents.ts
packages/core/src/core/scene/derivedParts.ts
packages/core/src/core/scene/derivedPath.ts
packages/core/src/core/scene/docValues.ts
packages/core/src/core/scene/documentOf.ts
packages/core/src/core/scene/editMode.ts
packages/core/src/core/scene/editPass.ts
packages/core/src/core/scene/editingSession.ts
packages/core/src/core/scene/effectivePose.ts
packages/core/src/core/scene/fieldEdits.ts
packages/core/src/core/scene/fontReads.ts
packages/core/src/core/scene/frameFixture.ts
packages/core/src/core/scene/historyFacade.ts
packages/core/src/core/scene/historyForm.ts
packages/core/src/core/scene/historyIds.ts
packages/core/src/core/scene/index.ts
packages/core/src/core/scene/inheritedPaint.ts
packages/core/src/core/scene/kitOps.ts
packages/core/src/core/scene/kitRegistry.ts
packages/core/src/core/scene/layerOps.ts
packages/core/src/core/scene/layerStack.ts
packages/core/src/core/scene/layerTypes.ts

<!-- done: 2 findings, files read: 40 -->
