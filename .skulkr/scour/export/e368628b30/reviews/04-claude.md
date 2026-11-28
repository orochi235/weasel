## selectionRegion hands back a zero-width or zero-height region, which the "draws nothing" check misses and the raster then refuses with an unrelated error
- where: packages/export/src/selectionRegion.ts:38 (selectionRegion), :62 (selectionRegionSource)
- scenario: a selection whose drawn box is degenerate on one axis (an unstroked horizontal/vertical line path, an empty-width text or group whose union collapses to a line) gives `unionAabb` a box with `height: 0`. `selectionRegion` returns it as a region rather than `null`, so `selectionRegionSource` does not throw its "draws nothing" error; the PNG/PDF export then fails inside `planPixelRender` → `checkPixelRenderRect` with "renderSceneToPixels: sourceRect.height must be a positive finite number, got 0". It should be treated as drawing nothing (null / the selection error), or given a minimum extent, one way in both places.
- evidence: read (checkPixelRenderRect in packages/core/src/canvas/pixelRenderRect.ts:15-17 refuses width/height <= 0; selectionRegion only tests `box === null`)
- severity: low
- size: line
- cause: null-only emptiness test, zero-area box not considered
- confidence: likely

## A dev "unread option" warning is suppressed for an override of the same format id that reads different options
- where: packages/export/src/exportFormats.ts:89 (warnUnreadOptions)
- scenario: `exportRegions(scene, r, 'png', { dpi: 2 })` warns once and records `png\0dpi`. A consumer then registers its own `png` format declaring `options: []` (or a different set), or disposes it and the built-in reappears; a later misspelled/unsupported `dpi` passed to the new format is never warned about, because the dedupe key is the id, not the format object whose `options` decided the warning. Keyed by format (e.g. a WeakMap<ExportFormat, Set<string>>) each registration would warn for itself.
- evidence: read
- severity: low
- size: function
- cause: dedupe keyed by id rather than the format registered
- confidence: sure

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

<!-- done: 2 findings, files read: 12 -->
