# Audit round 41 — core.core.scene.part1

## A derivation that throws on a re-derive leaves its memo record describing the new deps beside the old value, so later reads return the stale value without rethrowing
- where: packages/core/src/core/scene/depMemo.ts:103 (deriveRecorded; with recordDeps at :80)
- scenario: a node with `derivePose` (or `derivePath`) has a memo hit; a dependency changes, so `sameDeps` fails and `effectivePose.ts:131` / `derivedPath.ts:83` re-run into the *same* record object. `recordDeps(into, deps)` overwrites `nodes`/`poses`/`data`/`layers` with the new dependencies before `derive` runs. If `derive` throws (a consumer derivation that cannot handle the new dep state), `into.value` / `into.path` is never assigned, so the record now pairs the previous result with the new dependency snapshot. The caller sees the throw once; on the next read `sameDeps` answers true and the old pose/path is returned as if it were derived from the current deps, and the throw never recurs. Should leave the record untouched (or invalidated) when `derive` throws, e.g. record into a scratch record and copy on success.
- evidence: read
- severity: medium

## `bindOpToAdapter` and `bindOpToHistoryAdapter` drop the op's `caused()`, so an op that decides its effect as it runs is re-decided on undo/redo once bound
- where: packages/core/src/core/scene/boundOps.ts:10 (bindOpToAdapter), :48 (bindOpToHistoryAdapter)
- scenario: `Op.caused` (packages/history/src/op.ts:31) is "what the entry records in this op's place once it has applied … so undo and redo return to what it wrote rather than working it out again". Both wrappers copy `name`, `args`, `label`, `coalesceKey`, `elideNoop`, `apply`, `invert` but not `caused`. An external op with `caused` handed to `applyBatch` inside an open batch goes through `recorder.ts:200` (`outer.push(bindOpToAdapter(op, adapter))`), and the bound copy has no `caused`, so the entry records the op itself (or the kit ops captured by `outerOps.causing`) instead of the replay ops the op supplied. On the non-joined path (`outerOps.ts:102`) the converse happens: `causing(op, bound)` sees `op.caused` and returns the *unbound* `op`, which the engine then applies with no adapter. Either way the two paths answer "what does an op with `caused` record and apply against" differently; the wrappers should forward `caused` (rebinding its ops).
- evidence: read
- severity: low

## `pathFromParts` with two or more parts joins them under `nonzero`, so an `evenodd` part's holes become solid in the path picking and bounds read
- where: packages/core/src/core/scene/derivedParts.ts:64 (concatPaths), via `joinPaths` in packages/geom/src/paths/pathOrigin.ts:93
- scenario: a `derivePath` returns `pathFromParts([ring, other])` where `ring` is a polygon path with `fillRule: 'evenodd'` (an outer contour and an inner one wound the same way, as a glyph "O" or a boolean result commonly is). `concatPaths` hands the parts to `joinPaths`, which always writes `fillRule: 'nonzero'`, so the returned whole path — "what picking, bounds and every reader of `DerivedDep.path` see" — fills the ring's hole: a click in the hole hits the node, and a boolean group or derivation reading this dep's path takes the hole as filled. The painter paints each part as itself, so what is drawn and what is picked disagree. With a single part the part's own path (and rule) is kept, so the answer also changes with the part count.
- evidence: read
- severity: low

## `RebasedDep` drops `children`, so a group dependency read from another frame — including a group nested two deep in a boolean group — contributes nothing
- where: packages/core/src/core/scene/effectivePose.ts:212 (class RebasedDep), used at :206 (depsAsRead) and :294 (SceneDep.children)
- scenario: `DerivedDep.children` is how a derivation reads a group's members (`booleanOfChildren.ts:30` `operandOf` takes a group operand as the union of `dep.children`; `depMemo.ts:71` records them). `RebasedDep` forwards `node`, `pose`, `path`, `inherited` and `scene` but defines no `children`, so it reads `undefined`. Under a composing strategy (`RIGID_POSE_COMPOSITION`, the default) `SceneDep.children` wraps every child of a frame-defining group in a `RebasedDep`. Build boolean group → group A → group B → rect: the boolean group reads A as a plain `SceneDep`; A's `children` hands back B as a `RebasedDep`; `operandOf(B)` sees `kind === 'group'` and `dep.children ?? []` is empty, so the rect is no operand and the boolean result omits it (null if it was the only shape). Likewise any `dependsOn: [groupId]` derivation in a different container (rebased by `depsAsRead`) sees the group with no children. Under `IDENTITY_POSE_COMPOSITION` the same tree works, since nothing is rebased. `RebasedDep` should forward `children` (rebased into its frame).
- evidence: read
- severity: medium

## `editPasses.run` counts a pass op that reported a no-op as applied, so the edit-pass op is never elided and stops coalescing
- where: packages/core/src/core/scene/editPass.ts:128 (run), :168 (op().apply)
- scenario: the edit-pass op is `elideNoop: true` so that, when no pass wrote anything, it is left out of the entry and the edit can still coalesce with the next (history `Op.elideNoop`: "left in, it would stop the edit coalescing with one that needed none"). `run` does `op.apply(adapter); applied++` without looking at the return value, so a pass that answers with ops which turn out to change nothing (a sync pass returning `ops.setPose(id, samePose)` / a `setData` to the value already held, whose apply reports `'noop'`) makes `run()` return > 0 and the edit-pass op report "mutated". Each step of a coalescing gesture (a slider drag writing `setPose` with a coalesce key) then carries a non-elided edit-pass op and no longer merges, so one drag becomes many undo steps. Only applies that did not return `false`/`'noop'` should count.
- evidence: read
- severity: low

## `kit:removeLayer` and `kit:addLayer`'s revert splice by the recorded index instead of finding the layer by id, so a replay onto a scene with a different layer order removes the wrong layer silently
- where: packages/core/src/core/scene/layerOps.ts:40-46 (kit:addLayer revert, kit:removeLayer apply)
- scenario: `kit:moveLayer` deliberately finds its layer by id (`placeLayer`, "not by where the payload last left it"), but `kit:removeLayer` applies `state.layers.splice(p.index, 1)` and `kit:addLayer` reverts with `splice(p.index, 1)` without checking that the record at that index is `p.record.id`. Through `scene.replay(ops)` (historyForm.ts `SceneReplay`, whose contract is that a divergent scene throws), `kit:removeLayer { record: {id:'b'}, index: 2 }` recorded on a scene ordered `[a, c, b]` and replayed on a peer ordered `[a, b, c]` removes `c` and leaves `b` with its nodes already removed — no throw, layer index rebuilt over the wrong stack. The same happens for any restored or replayed history whose stack drifted. Look the layer up by id (and throw when absent), as `kit:moveLayer` does.
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

<!-- done: 6 findings, files read: 39 -->
