# Findings — path-tools.part2

## createOutlines / outlineStroke are enabled from `operands` but convert the adapter's selection
- where: packages/path-tools/src/outlines/createOutlinesAction.tsx:62 (createOutlinesAction invoker.run / enabled); packages/path-tools/src/outlines/outlineStrokeAction.tsx:24
- scenario: a host supplies `operands` other than the selection (core's `createOperandList([textId])`, documented "for acting on nodes no selection names"). `enabled` checks `deps.operands.get()` and turns the action on, but `run` calls `runCreateOutlines(adapter)` / `applyOutlineStroke(adapter)`, which read only `adapter.getSelection()`; the result ids go to `setSelection`, never `operands.set`. The action converts whatever is selected (or no-ops) instead of the operands it was enabled for. Should pass `deps.operands.get()` as the ids and hand results back through `operands.set`.
- evidence: read
- severity: medium

## withOutlines leaves an unhandled rejection and no notice when an outline's load() rejects
- where: packages/path-tools/src/outlines/createOutlinesAction.tsx:32 (withOutlines)
- scenario: the first conversion fails with a `pending` NodeOutlineError and the font face then fails to load, so `o.load()` rejects (its contract says it "settles once ... landed, or failed to"; nothing here catches). `Promise.all` rejects, `withOutlines` throws before `warnOutlines`, and both action invokers call it with `void`, so the user gets no notice and the runtime logs an unhandled promise rejection. Should catch the load failure (e.g. `Promise.allSettled`) and retry/warn as for a non-pending error.
- evidence: read
- severity: low

## Set Path / Set Spine / Release Spine leave a stale `foundHidden` entry, so a retargeted visible source is hidden for good
- where: packages/path-tools/src/pathEffects/hiding.ts:51 (takenOps); callers packages/path-tools/src/pathEffects/retarget.ts:66 (setEffectPathAction), packages/path-tools/src/pathEffects/spine.ts:64 (setTweenSpineAction), spine.ts:103 (releaseTweenSpineAction)
- scenario: make Text Along Path (hideSources by default) along a path that was already hidden on its own, so the effect stores `foundHidden: [1]`. Now Set Path to a visible path. `takenOps` sees the new path is not hidden on its own and returns only `setHidden(path, true)`; it never drops position 1 from `foundHidden` (it filters `at` only on the other branch). `sourcesHiddenBy` skips found-hidden positions, so the effect no longer counts as hiding the new path: Release, Expand, a later Set Path (`releasedOps`) and `hiddenSourceDeleteOps` all leave it hidden, and nothing ever shows it again. Same for a tween's spine slot 2: Release Spine drops source 2 without clearing `foundHidden`'s 2, and the next Set Spine on a visible path inherits it. The hide branch of `takenOps` should also write `foundHidden` without `at` when it held it.
- evidence: read (core `sourcesHiddenBy` in packages/core/src/domains/pathEffects/hiddenSources.ts:14 filters by `foundHidden` position)
- severity: medium

## Shape Builder is enabled from `operands` but plans and commits on the booleans adapter's selection
- where: packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts:40 (enoughSelected) vs :22 (createPlanCache.get)
- scenario: same split as the outlines actions: with a host `operands` list that is not the selection, `enoughSelected` enables `shapeBuilder` / `shapeBuilder.takeFace` on two operands, but the plan cache reads `adapter.getSelection()` and `planShapeBuilder` resolves operands from the adapter, so the faces shown and committed are those of the selection (or none). The two answers to "what does this act on" should be the one `operands` dep.
- evidence: read
- severity: low

## The "Make segments straight/curved" variants stay enabled when they would change nothing
- where: packages/path-tools/src/segmentType/convertSegments.ts:48 (convertSegmentsAction.enabled)
- scenario: select two anchors joined by a straight segment and look at the `line` variant (params `{ to: 'line' }`). `enabled` ignores its params and tests `convertSegments(set, segs)` with no `to`, the toggle, which would curve the segment, so it answers true; `run` with `to: 'line'` changes nothing and commits nothing. Same for `curve` on curved segments. Ruled 2026-11-10 (pathStructure.ts:117): an edit that would change nothing is disabled. `enabled` should pass `typeOf(params)` (and answer NotApplicable, not SelectionRequired, when anchors are selected but nothing would change).
- evidence: read
- severity: low

## Sand's preview ignores a tolerance change mid-stroke that its commit applies
- where: packages/path-tools/src/sand/sand.ts:106 (sweepTo) and :130 (onEnd)
- scenario: during a Sand drag, step the tool's strength (`Shift+]`, the `tolerance` option, read through the thunked params "so a thunk can change them mid-stroke"). `sweepTo` recomputes `current` only when the brush gathers a new anchor, so the preview keeps the old tolerance's refit while the pointer moves over anchors already gathered; release commits `toleranceOf(params())`, a different shape from the one previewed. The preview should be recomputed when the tolerance read differs from the one it was built at.
- evidence: read
- severity: low

## withOutlines' retry runs the adapter through an `Object.create` wrapper, which breaks an adapter class using private fields
- where: packages/path-tools/src/outlines/createOutlinesAction.tsx:33 (withOutlines)
- scenario: a consumer implements `CreateOutlinesAdapter` as a class whose methods read `#private` fields (`getOutline(id) { return this.#scene… }`). The first, pending attempt runs on the adapter itself; the retry calls `apply(held)` where `held = Object.create(adapter, …)`, so every method runs with `this === held`, which has no private slots: `TypeError: Cannot read private member`. The first conversion of a session (exactly the font-loading case the retry exists for) throws instead of converting, inside a `void`ed promise. Wrapping by delegation (`{ ...bound methods, getSelection }`) or passing the ids explicitly avoids it.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/outlines/createOutlines.ts
packages/path-tools/src/outlines/createOutlinesAction.tsx
packages/path-tools/src/outlines/outlineStroke.ts
packages/path-tools/src/outlines/outlineStrokeAction.tsx
packages/path-tools/src/outlines/replaceWithPaths.ts
packages/path-tools/src/outlines/useCreateOutlinesAdapter.ts
packages/path-tools/src/overlays/showOverlay.ts
packages/path-tools/src/pathCommands/cutJoin.ts
packages/path-tools/src/pathCommands/joinAnchorData.ts
packages/path-tools/src/pathCommands/livePathEdit.ts
packages/path-tools/src/pathCommands/pieceOrigins.ts
packages/path-tools/src/pathCommands/simplifyOffset.ts
packages/path-tools/src/pathEffects/actions.ts
packages/path-tools/src/pathEffects/effectForms.ts
packages/path-tools/src/pathEffects/hiding.ts
packages/path-tools/src/pathEffects/params.ts
packages/path-tools/src/pathEffects/retarget.ts
packages/path-tools/src/pathEffects/settingsForm.ts
packages/path-tools/src/pathEffects/spine.ts
packages/path-tools/src/pathStructure/directionMarks.ts
packages/path-tools/src/pathStructure/pathStructure.ts
packages/path-tools/src/pathsPreset.ts
packages/path-tools/src/pbt.fixture.ts
packages/path-tools/src/pencil/usePencilTool.tsx
packages/path-tools/src/poise/poiseHandles.ts
packages/path-tools/src/poise/poiseMarks.ts
packages/path-tools/src/presets.ts
packages/path-tools/src/reach/reachToMeet.ts
packages/path-tools/src/reach/useReachTool.ts
packages/path-tools/src/resample/resample.ts
packages/path-tools/src/sand/sand.ts
packages/path-tools/src/sand/useSandTool.ts
packages/path-tools/src/segmentType/convertSegments.ts
packages/path-tools/src/settingsFields.ts
packages/path-tools/src/shapeBuilder/index.ts
packages/path-tools/src/shapeBuilder/shapeBuilder.ts
packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts

<!-- done: 7 findings, files read: 37 -->
