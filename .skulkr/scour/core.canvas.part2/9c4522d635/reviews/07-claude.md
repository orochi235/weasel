## LodState answers `rungOf`/`skips` from a walk key that is no longer walked, ahead of the node's current one
- where: packages/core/src/canvas/lod/lodState.ts:41 (createLodState, `find`)
- scenario: a view paints layers A and B, so `walks` holds maps for keys A then B. A node on A is recorded at `'none'` (or a skipping rung). Layer A is hidden (or deleted) so its walk stops beginning, and the node is moved to B, where B's walk records it at `'full'`. `find` iterates `walks` in insertion order and returns A's stale entry first, so `pickWalk` reads `rungOf === 'none'` and the node, drawn in full on B, cannot be picked; `collapsedAbove` can likewise report a collapse that is no longer drawn. A key whose walk never runs again is never dropped, so `size()`'s "at most what the walks of the last frame visited" is also wrong. Should prefer the map of the key that last recorded the id, or drop keys not walked in a frame.
- evidence: read (that a hidden layer begins no walk is inference)
- severity: low

## A ladder sized `Infinity` under a zero-scale view picks the coarsest rung, not the finest
- where: packages/core/src/canvas/lod/lodWalk.ts:139 (createLodWalk `pick`)
- scenario: `sizeOf` returns `Infinity` (documented as "keeps the finest rung", e.g. screen-sized text), or `poseSizeOf` returns it for a pose with no box, and `pixelScaleAt(view, dpr)` is 0 (a view with scale 0 on both axes, or dpr 0). `world * pxPerUnit` is `Infinity * 0 = NaN`; only `world` is checked for NaN, so `rungIndexAt` gets NaN, every comparison is false, and the node takes rung 0 (or stays at `prev`) — `'none'`/`'box'` for a collapse ladder — instead of the finest rung.
- evidence: read
- severity: low

## An insert preview's non-finite `sides`/`points` in `extras` reaches the path builders as NaN
- where: packages/core/src/canvas/insertPreviewExtent.ts:103 (extentOf, `polygon` / `star` cases)
- scenario: `extras` is documented as opaque; one carrying `sides: NaN` (or `points: NaN`, e.g. from a cleared numeric field) gives `Math.max(3, Math.floor(NaN)) === NaN`, since `Math.max` propagates NaN. `regularPolygonPath`/`starPath` then build with NaN sides, and the preview, commit and reported bounds all get a NaN box. The `Math.max(3, …)` floor was meant to clamp a bad value; it should fall back to `SHAPE_DEFAULTS` for a non-finite one.
- evidence: read
- severity: low

## `satisfiesRange` reports an empty range as invalid where npm reads it as `*`
- where: packages/core/src/canvas/kitRequirements.ts:139 (satisfiesRange)
- scenario: a contribution declares `requires: { core: '' }` (npm's grammar: `''` is the same as `*`, any version). `alt === ''` returns `null`, so `checkRequirements` reports `reason: 'invalid-range'` and the contribution is refused or warned against, though the header says the grammar is npm's everyday subset. Likewise `'1.x || '` with a trailing empty alternative.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/lod/ladder.ts
packages/core/src/canvas/lod/lodBox.ts
packages/core/src/canvas/lod/lodState.ts
packages/core/src/canvas/lod/lodWalk.ts
packages/core/src/canvas/mountedCanvases.ts
packages/core/src/canvas/nodeOutline.ts
packages/core/src/canvas/nodeShapeRegistry.ts
packages/core/src/canvas/nodeShapeTypes.ts
packages/core/src/canvas/overChildren.ts
packages/core/src/canvas/overlayRoleStrokes.ts
packages/core/src/canvas/ownClip.ts
packages/core/src/canvas/paintCull.ts
packages/core/src/canvas/paintOverrides.ts
packages/core/src/canvas/paintStandIns.ts
packages/core/src/canvas/paintedCursorLayer.ts
packages/core/src/canvas/pasteOnPages.ts
packages/core/src/canvas/pasteShape.ts
packages/core/src/canvas/pathOverlay.ts
packages/core/src/canvas/pbt.fixture.ts
packages/core/src/canvas/pickIndex/nodeBroadBox.ts
packages/core/src/canvas/pickIndex/pickIndexFixture.ts
packages/core/src/canvas/pickIndex/scenePickIndex.ts
packages/core/src/canvas/pickReach.ts
packages/core/src/canvas/pickWalk.ts
packages/core/src/canvas/pixelPick.ts
packages/core/src/canvas/pixelRenderRect.ts
packages/core/src/canvas/pixelScale.ts
packages/core/src/canvas/planeClips.ts
packages/core/src/canvas/poseRotation.ts

<!-- done: 4 findings, files read: 39 -->
