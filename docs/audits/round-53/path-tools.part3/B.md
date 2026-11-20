# Findings: path-tools.part3 (round 53)

## Spiro tool's deactivate leaves its pointer follower and its trailing snap session open
- where: packages/path-tools/src/spiro/useSpiroTool.ts:177 (useSpiroTool onDeactivate) with :56-66 (spiroActions follower/track)
- scenario: place two points, then switch tools from the keyboard (or by a toolbar click with the pointer off the canvas). `onDeactivate` only swaps in `fresh()` scratch and re-renders; unlike `spiro.cancel` (`host.reset(); track()`) and slice's `resetPendingCut` (`live.unfollow()`), it never calls `follower.unfollow()` or `snaps.stop()`. The `pointSnap` trail session begun in `track()` (`dep.begin({ gesture: 'point', ... })`) stays live, so whatever the snap dep shows for an open session (guides, the snapped-cursor hint) stays up under the next tool, and the follower stays subscribed to the canvas pointer, until the next pointer event happens to run `track()` and notice zero points. If the canvas unmounts first, the session is never ended. Should end the session and unfollow on deactivate.
- evidence: read (pointSnap.ts:39-46 keeps `live` until `stop()`)
- severity: medium

## A warp begun on text whose face is still loading never converts it, so the first drag on the controls shown over that text does nothing
- where: packages/path-tools/src/warp/warpActions.ts:75-82 (beginOnText), with packages/path-tools/src/shared/outlineSession.ts:58-63 (convertOne)
- scenario: select a text node whose font is registered but whose outlines have not been parsed yet (first use of the face). The handle layer shows a fresh warp's controls over the text (`freshWarpBox` includes `textsBox`). Press a control: `beginOnText` calls `session.convert()` once; `applyCreateOutlines` reports `pending`, so the node goes into `loading` and stays text. No later call to `convert` follows (knead calls it on every move, at knead.ts:90; warp only at the start). With text alone selected `warpTargets` finds no bare paths, `grabControl` returns null and the drag hands off to the next binding, so the drag does nothing to the text (or falls through to whatever is next). With text and paths selected, the paths are warped over a box sized to include text that stays untouched. `pin.addPin` (line 220) has the same single call. Should wait for the load, or convert again on a move, as `OutlineSession.convert` says it is meant to be used.
- evidence: read
- severity: low

## `configureWarp` and `expandWarp` are enabled by a stale warp the run then ignores, and read different node shapes than the run
- where: packages/path-tools/src/warp/warpActions.ts:281-285 (holdsWarp) vs :335-337 (configureWarpAction.run) and warpSettingsForm.ts:41-42 (readWarpSettings)
- scenario: a path holds `data.warp` but was then edited some other way (a path-edit drag), so the warp no longer reproduces it (`resolvePathWarp` returns null, the file's own doc says such a warp "is ignored"). `holdsWarp` tests `heldPathWarpOf(node.data)`, which accepts any well-formed held warp, so Warp Settings shows as enabled; its form (`resolvePathWarp(shown)`) shows no sections, and a run (`resolvePathWarp(node.shown)`) skips the path and commits nothing. The enable check also reads `node.data` where the run reads `node.shown`. The same check enables Expand Warp, whose run then drops a warp nobody could see. The decision of "does this selection hold a warp" is answered two ways; `holdsWarp` should use `resolvePathWarp(node.shown)` like the run and the form.
- evidence: read
- severity: low

## A non-finite rows/cols reaching `configureWarp` builds a NaN mesh
- where: packages/path-tools/src/warp/warpTargets.ts:61-62 (count), reached through warpParams.ts:46-50 (warpSettingOf) and warpActions.ts:338 (withWarpSettings)
- scenario: the settings form or the last-operation panel hands `configureWarp` `{ kind: 'cloth', rows: NaN }` (a cleared number input). `warpSettingOf` accepts it because `typeof NaN === 'number'`; `count(NaN, 3)` is `Math.min(16, Math.max(1, Math.round(NaN)))` = NaN, since `v ?? fallback` only falls back on null/undefined; `resizeCloth(warp, NaN, cols)` then resamples a mesh with NaN rows (`meshGridFrom`), corrupting the stored warp and its geometry in one undoable step. `count` should fall back when `v` is not finite (registry's `isFiniteNumber`), and `warpSettingOf` should reject a non-finite number.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/shapeBuilder/useShapeBuilderTool.ts
packages/path-tools/src/shared/outlineSession.ts
packages/path-tools/src/shared/scenePaths.ts
packages/path-tools/src/shared/strokeClickTool.ts
packages/path-tools/src/shared/testing/editHarness.ts
packages/path-tools/src/shared/testing/lastOperation.tsx
packages/path-tools/src/shared/testing/outlineScene.ts
packages/path-tools/src/slice/slice.ts
packages/path-tools/src/slice/slicePaths.ts
packages/path-tools/src/slice/slicePendingCut.ts
packages/path-tools/src/slice/slicePendingCutLayer.ts
packages/path-tools/src/slice/useSliceTool.ts
packages/path-tools/src/snip/piecePreview.ts
packages/path-tools/src/snip/snip.ts
packages/path-tools/src/snip/useSnipTool.ts
packages/path-tools/src/spiro/index.ts
packages/path-tools/src/spiro/spiroCommands.ts
packages/path-tools/src/spiro/spiroInsertPoint.ts
packages/path-tools/src/spiro/spiroMarkers.ts
packages/path-tools/src/spiro/spiroPreset.ts
packages/path-tools/src/spiro/spiroPreviewLayer.ts
packages/path-tools/src/spiro/spiroRepresentation.ts
packages/path-tools/src/spiro/spiroShape.ts
packages/path-tools/src/spiro/useSpiroTool.ts
packages/path-tools/src/toolSets.ts
packages/path-tools/src/tug/tugPath.ts
packages/path-tools/src/tug/useTugTool.ts
packages/path-tools/src/warp/pathWarp.ts
packages/path-tools/src/warp/useWarpTool.ts
packages/path-tools/src/warp/warpActions.ts
packages/path-tools/src/warp/warpHandles.ts
packages/path-tools/src/warp/warpParams.ts
packages/path-tools/src/warp/warpSelection.ts
packages/path-tools/src/warp/warpSettingsForm.ts
packages/path-tools/src/warp/warpTargets.ts

<!-- done: 4 findings, files read: 35 -->
