# Audit round 53 — path-tools.part3 findings

## Snip's hover preview ignores a tuned `snipPath` radius, so the dashed piece and the click disagree
- where: packages/path-tools/src/snip/useSnipTool.ts:27 (`snip.preview` action, via `planSnip`/`pressOf` in packages/path-tools/src/shared/scenePaths.ts:35)
- scenario: `<SceneCanvas tune={{ snipPath: { params: { radiusPx: 14 } } }}>` with the default `useSnipTool()`. The click runs `snipPath`, whose tuned params give `radiusPx: 14`; the hover runs `snip.preview`, a different action id the tuning never reaches, so `pressOf` falls back to `DEFAULT_STROKE_REACH_PX` (6). Hovering 10 px from a stroke shows no piece, yet clicking there snips it; the tool's doc promises the preview goes "through the same `planSnip` the click commits". Only `options.radiusPx` on the tool reaches both. The preview should read the reach the click will use (e.g. resolve `snipPath`'s params through the `actionParams` dep, as the warp layer does with `paramsOf`).
- evidence: read
- severity: medium

## Spiro tool's deactivation leaves its snap trail session open and its pointer follower subscribed
- where: packages/path-tools/src/spiro/useSpiroTool.ts:177 (`onDeactivate`), with `track`/`snaps`/`follower` at :48–66
- scenario: place two spiro points (the cursor's `snaps.trail` opens a live snap session and `follower.follow` subscribes to the pointer), then switch tools by key without moving the mouse. `onDeactivate` only swaps in a fresh scratch; it cannot reach `snaps.stop()` or `follower.unfollow()`, which run only from `track()`. The snap session (and whatever guides it is showing) stays open and the follower stays subscribed until the next pointer move happens to call `track()`; if the canvas goes away first, they never end. Commit and cancel do call `track()` after reset; deactivation should too (the knife's `resetPendingCut` unfollows on deactivate).
- evidence: read
- severity: low

## `configureWarp` is enabled on a selection whose warp is stale, then does nothing
- where: packages/path-tools/src/warp/warpActions.ts:281 (`holdsWarp`) vs :336 (`configureWarpAction.run`) and packages/path-tools/src/warp/warpSettingsForm.ts:42
- scenario: a path holds `data.warp` but its geometry was rewritten by a non-affine edit, so `resolvePathWarp` returns null (the file's own rule: such a warp "is ignored"). `holdsWarp` tests only `heldPathWarpOf(node.data)`, so Warp Settings shows enabled; its form (`readWarpSettings`, which resolves) reads no warps and hides both sections, and a run skips every node. The enable check and the run answer "does this selection hold a warp" two ways; `holdsWarp` should resolve as `configureWarp` does (expand may keep the looser test, since dropping a stale warp is meaningful).
- evidence: read
- severity: low

## A warp tool attached to two canvases loses the first canvas when either detaches
- where: packages/path-tools/src/warp/useWarpTool.ts:96 (`createWarpToolState().attachTo`) and :117–126 (`attach`)
- scenario: the same `usePlaneWarpTool()` result passed to two `<SceneCanvas tools>` (two views of one document). Each `attach` overwrites the single `api`/`deps` slot, so the handle layer on canvas A reads canvas B's `scene`/`createOutlinesAdapter`, and `setActive` redraws only B. When B unmounts its cleanup calls `attachTo(null, null)`, so A's layer's `scene()` returns undefined and A's warp controls vanish while A is still mounted. State should be per attachment (or `attach` should restore the previous attachment on cleanup).
- evidence: read
- severity: low

## Cloth warp row/column settings accept NaN, which `count` passes through to `resizeCloth`
- where: packages/path-tools/src/warp/warpParams.ts:48 (`warpSettingOf`) and packages/path-tools/src/warp/warpTargets.ts:61 (`count`)
- scenario: `warpSettingOf('rows', NaN)` passes (`typeof NaN === 'number'`), as does a direct `configureWarp` run with `{ rows: NaN }`. `count` does `Math.min(16, Math.max(1, Math.round(NaN)))`, which is NaN, not a value in 1–16, and `withWarpSettings` hands it to `resizeCloth`, which builds the mesh from a NaN row count. `count` should fall back for a non-finite value (`isFiniteNumber`), and `warpSettingOf` should reject one. Whether the settings form's number input can emit NaN was not checked.
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

<!-- done: 5 findings, files read: 35 -->
