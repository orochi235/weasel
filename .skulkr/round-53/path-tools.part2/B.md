# Findings: path-tools.part2 (round 53)

## Retargeting a source slot leaves a stale `foundHidden` index, so the new source is never shown again on release
- where: packages/path-tools/src/pathEffects/hiding.ts:51 (takenOps), used by retarget.ts:66 (setEffectPathAction) and spine.ts:64 (setTweenSpineAction)
- scenario: make a Text Along Path whose path P1 was already hidden (effect gets `foundHidden: [1]`). Set Path to a visible path P2: `takenOps` sees P2 is not hidden on its own, returns only `setHidden(P2, true)`, and leaves `foundHidden: [1]` untouched. Now `sourcesHiddenBy` (core hiddenSources.ts:22) excludes slot 1, i.e. P2. Release (or Set Path again, or Expand) calls `releasedOps`, which finds the effect does not "hold" P2 and leaves it hidden forever; deleting the effect also doesn't take P2 with it. Same for a tween with `hideSources` whose spine slot 2 was found hidden, then released and set to a visible spine. Should: drop `at` from `foundHidden` when the new source is hidden by the effect (filter `i !== at` on both branches).
- evidence: read
- severity: medium

## Reach outside path edit drops the tracked origins, so a path's per-anchor widths and colors are lost when an end grows new segments
- where: packages/path-tools/src/reach/reachToMeet.ts:161 (reachToMeetAction.run)
- scenario: select (not path-edit) an open stroke carrying `stroke.vertexWidths` whose end is curved, and run Reach with the default eased shape. `tugPathEnd` continues a curved end "with new segments" (geom tugPathEnd.ts module comment), so the anchor count grows. `extendEnds` computes `origins` through `editAnchorSetTracked`, but this branch calls `reshapeOps(node, path, REACH_LABEL)` with no anchor data; core's `withShownPath` then fits arrays to the new count (`withAnchorDataFitting`) and the widths/colors no longer match or are dropped. The same edit of the same path in path edit goes through `dep.applyEdit(..., edited.origins)` and keeps them, as Join (`joinedAnchorData`) and Cut (`pieceOrigins`) do for selection commands. Should pass `anchorDataPatch(node.node.data, node.path, path, origins)` as `reshapeOps`' fourth argument.
- evidence: read
- severity: medium

## Shape Builder's plan cache ignores stacking order, so a reorder between hover and commit builds from stale sources
- where: packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts:23 (createPlanCache.get)
- scenario: select two overlapping paths with the Shape Builder tool, hover (plan cached), then bring the back one to front (Mod+]) without moving the pointer off, and click a shared face. The key is the options, the selection ids in selection order, each world path and paint; none changes on a z-reorder, so the cached plan is reused. `planShapeBuilder` took `sources` back to front from `resolveBooleanOperands` and assigned each face to `p.sources[last]`, the topmost then; after the reorder the face is minted from, and wears the paint of, the source that is now underneath, and pieces are sorted by the stale source order. Should: key on the operands' resolved order (or the sources' slots) as well.
- evidence: read
- severity: low

## `convertSegments`' enabled check ignores the variant's `to`, so "Make segments straight" is enabled on already-straight segments and does nothing
- where: packages/path-tools/src/segmentType/convertSegments.ts:48 (convertSegmentsAction.enabled)
- scenario: in path edit, select two adjacent anchors joined by a straight segment; the `line` variant ("Make segments straight", params `{ to: 'line' }`) asks `enabled`, which calls `convertSegments(set, segs)` with no type: the toggle, which would curve them, so it answers true. Running it with `to: 'line'` changes nothing (no undo entry). Contrary to the 2026-11-10 ruling that an edit changing nothing is disabled; `enabled` receives params as its fourth argument and should pass `typeOf(params)`. It also answers `SelectionRequired` rather than `NotApplicable` when anchors are selected but nothing would change.
- evidence: read
- severity: low

## A node deleted while Create Outlines / Outline Stroke waits for a face stays in the selection the retry sets
- where: packages/path-tools/src/outlines/createOutlinesAction.tsx:33 (withOutlines) with replaceWithPaths.ts:50
- scenario: select a text (first use of its face, so `NodeOutlineError.pending`) and a rect, run Create Outlines, and delete the rect before the face loads. The retry runs with `getSelection` pinned to `asked`; the deleted id is skipped for conversion, as documented, but `replaceWithPaths` sets the selection `to: sel.flatMap(id => replaced.get(id) ?? [id])`, keeping the deleted rect's id, and `from: asked` rather than the selection actually in force, so undo restores a selection the user never had. Should: filter `asked` to ids still in the scene (`adapter.getNode(id)`) and take `from` from the live selection.
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

<!-- done: 5 findings, files read: 37 -->
