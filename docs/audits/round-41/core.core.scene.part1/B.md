# Audit round 41 — core.core.scene.part1

## A child that leaves a container and returns within one edit is reported as an arrival
- where: packages/core/src/core/scene/arrivalWindow.ts:158 (noteArrival) and :117 (settle)
- scenario: X starts under container A. One batch moves X from A to B, then from B back to A. `noteDeparture(X, A, B)` files X as departing A; `noteDeparture(X, B, A)` is skipped because X arrived at B in this edit; `noteArrival(X, A, B)` appends X to `arrivals[A]`. At settle, `heldMoves(..., true)` keeps X under A (its parent is A), so the handler is told X *joined* A, while the departure side correctly drops it ("a child that left and came back did not depart"). A layout handler that places arrivals (e.g. appends them, or refuses arrivals to a full container) then reorders X or refuses an edit that changed nothing about A's membership. The departure side and the arrival side answer "did it really move?" two different ways; the arrival side should likewise drop an id that was already a child of the container when the window opened (e.g. skip `noteArrival` when the id is in `departures.get(parent)`, removing it from there).
- evidence: read
- severity: low

## `bindOpToAdapter` and `bindOpToHistoryAdapter` drop an op's `caused()`, so an outer op that defines it is applied unbound
- where: packages/core/src/core/scene/boundOps.ts:10 (bindOpToAdapter), :48 (bindOpToHistoryAdapter)
- scenario: `Op.caused?()` is part of the history `Op` contract (packages/history/src/op.ts:31) and a consumer op may define it. Both binders copy `name/args/label/coalesceKey/elideNoop/apply/invert` and nothing else, so a bound op loses `caused`. The one caller that would need it works around this by checking the *unbound* op first: `outerOps.causing(op, bindOpToAdapter(op, adapter))` returns `op` itself when `op.caused` is set (outerOps.ts:67), so `scene.applyBatch(ops, label, adapter)` hands the engine an op that is **not** bound to `adapter`; the scene's engine was built without one, so its `apply(adapter)` receives `undefined` on the first apply and on every undo/redo. Through `recorder.join` (recorder.ts:200) the bound copy silently loses `caused`, so the entry records the op rather than what it says it caused. The binders should forward `caused` (rebinding each caused op), and `causing` should then bind before testing.
- evidence: read
- severity: medium

## A group two levels down inside a boolean group contributes nothing: `RebasedDep` has no `children`
- where: packages/core/src/core/scene/effectivePose.ts:212 (class RebasedDep), :288 (SceneDep.children); read by packages/core/src/core/scene/booleanOfChildren.ts:30 (operandOf)
- scenario: Under the default rigid composition, a boolean group B holds a plain group G1, which holds another plain group G2 with marks inside. `booleanOfChildren` → `operandOf(G1)` reads `G1dep.children`; G1 defines a frame, so `SceneDep.children` (effectivePose.ts:294) wraps each of G1's children — G2 included — in a `RebasedDep`. `operandOf(G2)` then reads `G2dep.children`, but `RebasedDep` declares only `node/pose/path/inherited/scene`, so `children` is `undefined`, `outlinesOf([])` is empty, and G2's whole contents drop out of the boolean (union shrinks, subtract stops subtracting). The same holds for any derivation with explicit `dependsOn` naming a node in another frame (`depsAsRead` wraps it in a `RebasedDep`) and then reading its `children`. Expected: `RebasedDep.children` answers the wrapped dep's children, composed through the rebased pose, so nesting depth doesn't change the result.
- evidence: read
- severity: medium

## `kit:addLayer` applies over an existing layer id, where `kit:add` refuses a colliding node id
- where: packages/core/src/core/scene/layerOps.ts:39 (kit:addLayer apply); duplicate check only in packages/core/src/core/scene/layerStack.ts:171 (addLayer)
- scenario: The duplicate-id check lives only in the `scene.addLayer` front door. Ops that reach the handler without it — `scene.replay(ops)` forwarding another scene's `kit:addLayer` (historyForm.ts:62 `SceneReplay` promises "when an op throws, as one addressing a node this scene does not hold does, the ops before it are taken back" so a diverged peer is detected), or a journal/applyBatch carrying a rebuilt `kit:addLayer` — splice a second record with the same id into `state.layers`. `rebuildLayerIndex` then maps the id to the later index only; the earlier record still paints and is counted by `layers`, `setLayerVisible` and `removeLayer` reach only one of the two, and undo's `splice(p.index, 1)` may take out the wrong one. `kit:add` answers the same question the other way: its apply throws `id collision` (kitOps.ts:192), so a diverged replay fails loudly and atomically. `kit:addLayer` apply should throw on `state.layerIndex.has(p.record.id)` the same way.
- evidence: read
- severity: low

## Layer `parallax` options are stored by reference and never owned, unlike every other value a scene edit stores
- where: packages/core/src/core/scene/layerOps.ts:10 (setParallax), :40 (kit:addLayer apply), packages/core/src/core/scene/layerStack.ts:26 and :179 (systemLayerRecord, addLayer)
- scenario: Poses, data, declared fields and doc values all pass through `own()` (deep-frozen in development) because the scene and its history keep them by reference. `setLayerParallax(layer, opts)` stores the caller's `opts` object as is, and `kit:addLayer`'s `{ ...p.record }` copy is shallow, so the record shares the caller's object. A consumer that keeps its `ParallaxOptions` object and mutates it (e.g. an animation stepping `opts.depth` and calling `setLayerParallax(layer, opts)` inside `untracked`) changes the stored layer and the undo payload's `from` in place: `sameValue(rec.parallax, parallax)` then sees the same reference and skips the edit, so subscribers are never told, and undo restores a `from` that was mutated to the new value. Development builds don't throw on the stray write, as they do for a pose. The parallax value should go through `own()` on write like the rest.
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
packages/core/src/core/scene/index.ts
packages/core/src/core/scene/inheritedPaint.ts
packages/core/src/core/scene/kitOps.ts
packages/core/src/core/scene/kitRegistry.ts
packages/core/src/core/scene/layerOps.ts
packages/core/src/core/scene/layerStack.ts
packages/core/src/core/scene/layerTypes.ts

<!-- done: 5 findings, files read: 39 -->
