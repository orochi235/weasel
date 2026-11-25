# Audit round 70 — core.core.scene.part1

## A derived node's memo never re-checks a dependency's inherited paint, so a container's fill change leaves it stale
- where: packages/core/src/core/scene/depMemo.ts:63 (RecordedDep.inherited), :140 (sameDep)
- scenario: a path effect (pathEffects/derive.ts → domains/pathEffects/readSource.ts reads `dep.inherited` through `withInheritedPaint`/`pathPaintOf`) derives from a source whose `fill`/`stroke` is `'inherit'`. The user changes the source's container's `data.fill`/`stroke`. The source's node, data, layer, pose and path are unchanged, so `sameDeps` answers true and `resolveDerivedPath`/`derivedPoseIn` return the memoized record without calling `derivePath`; the effect's own inner memo (`current` in derive.ts, which does compare `inherited`) is never reached. The effect keeps painting/measuring the old inherited paint until something else pushes. `RecordedDep.inherited` passes the read through without recording it, while the module doc says the record covers "what a derivation may read of a dependency". Should record `inherited` per dep (its reference is stable via `inheritedPaintOf`'s LAST memo) and compare it in `sameDep`.
- evidence: read (the absence of a push for an ancestor's data change to its descendants' dependents is inferred: the scene's push drops dependents of the edited node, and the effect depends on the source, not its container)
- severity: medium

## A failed atomic edit whose log names an op kind no longer registered throws out of the revert loop, skipping the rest of the revert and masking the original error
- where: packages/core/src/core/scene/appliedLog.ts:63 (atomically)
- scenario: `env.registered.get(kind)!` is evaluated outside the per-op `try`, so when it answers undefined (a kind unregistered by `fn` before it threw, e.g. a registerOp remover run inside the edit), `handler.apply`/`revert` throws a TypeError that escapes `env.lifted`: the older ops are not taken back, the selection is not restored, `notify` is skipped, and the caller sees the TypeError instead of `fn`'s error. The documented contract is "a revert that throws is logged and skipped; fn's throw is the one rethrown". The lookup belongs inside the try.
- evidence: read
- severity: low

## Reverting `kit:setLayer` onto a hidden or locked layer leaves the node in the selection
- where: packages/core/src/core/scene/kitOps.ts:99 (registerSetLayer revert)
- scenario: `apply` calls `env.narrowSelection()` after placing the node, but `revert` does not, although it can place the node back onto a hidden or locked layer (the forward edit moved it off one). Paths that do not restore the selection from a history entry — `SceneReplay.replay` of another scene's `revert:kit:setLayer`, a journal cancel, or a later op in the same atomic edit reading the selection — leave a node on a hidden/locked layer selected, which the layer-op contract ("Hiding drops its nodes from the selection", locked nodes are out of reach) rules out. `kit:setLayerVisible`/`kit:setLayerLocked` and `kit:move` narrow on both halves; this one is asymmetric.
- evidence: read (which callers skip a selection restore is inferred from historyForm.ts's `SceneReplay` doc)
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

<!-- done: 3 findings, files read: 40 -->
