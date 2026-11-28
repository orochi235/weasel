# export: findings

## selectionRegion answers a zero-width or zero-height region as "draws something", which the PNG export then refuses
- where: packages/export/src/selectionRegion.ts:38 (selectionRegion)
- scenario: select only a straight horizontal (or vertical) path with no stroke, or any node whose drawn box is degenerate on one axis. `unionAabb` returns a box with `height: 0`, so `selectionRegion` returns a region rather than `null`, and `selectionRegionSource` does not raise its "draws nothing" error. `exportRegions(scene, selectionRegionsSource(ids), 'png')` then reaches `planPixelRender`, whose `checkPixelRenderRect` throws `renderSceneToPixels: sourceRect.height must be a positive finite number, got 0`. Expected: either `null` / the "draws nothing" error that the doc promises for a selection drawing nothing, or a region the formats accept.
- evidence: read (selectionRegion.ts:38-39, core canvas/pixelRenderRect.ts:15-16); not run
- severity: low
- fix: packages/export/src/selectionRegion.ts
- size: line
- cause: degenerate box not treated as empty
- confidence: likely

## Files read
packages/export/src/captureExport.ts
packages/export/src/exportDiagnostics.ts
packages/export/src/exportFormats.ts
packages/export/src/exportPages.ts
packages/export/src/exportTypes.ts
packages/export/src/index.ts
packages/export/src/placedRects.fixture.ts
packages/export/src/regionPng.ts
packages/export/src/regionRenderArgs.ts
packages/export/src/selectionRegion.ts
packages/export/src/testing/parallaxScene.ts
packages/export/src/testing/plainScene.ts

<!-- done: 1 findings, files read: 12 -->
