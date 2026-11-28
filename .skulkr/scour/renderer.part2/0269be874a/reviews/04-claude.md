# renderer.part2 findings

## `createTilePattern`'s doc says it returns null only without an OffscreenCanvas, but it also returns null for a size under one pixel or not finite
- where: packages/renderer/src/patterns/index.ts:24 (createTilePattern)
- scenario: `createTilePattern({ size: 0.5, draw })` or `{ size: NaN }` in a browser with `OffscreenCanvas` → `rasterizeTile` returns null on its first line (`!(opts.size >= 1 && Number.isFinite(opts.size))`), so `createTilePattern` returns null. Its doc ("Returns `null` only when an `OffscreenCanvas`/2D context can't be acquired") tells a caller that a null means no canvas, so a caller that falls back on that reading (for example, retrying once a canvas exists, or reporting "no OffscreenCanvas") misreads a bad size.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/index.ts
- size: line
- cause: doc not updated when rasterizeTile gained its size guard
- confidence: sure

## Files read
packages/renderer/src/paintKinds.ts
packages/renderer/src/paintResources.ts
packages/renderer/src/paintScratch.ts
packages/renderer/src/paintToLocalUnits.ts
packages/renderer/src/paintedBounds.ts
packages/renderer/src/patterns-builtin.ts
packages/renderer/src/patterns/commandPaint.ts
packages/renderer/src/patterns/imagePatternId.ts
packages/renderer/src/patterns/index.ts
packages/renderer/src/patterns/patterns-builtin.ts
packages/renderer/src/patterns/rasterizeTile.ts
packages/renderer/src/patterns/resolveImage.ts
packages/renderer/src/patterns/resolveSpec.ts
packages/renderer/src/patterns/test-utils/fakeOffscreenCanvas.ts
packages/renderer/src/patterns/tileGeometry.ts
packages/renderer/src/pbt.fixture.ts
packages/renderer/src/readPixels.ts
packages/renderer/src/rendererParts.ts
packages/renderer/src/rendererTypes.ts
packages/renderer/src/retain/RetainedSurfaces.ts
packages/renderer/src/retain/TileTextures.ts
packages/renderer/src/retain/bakeTile.ts
packages/renderer/src/retain/contentBounds.ts
packages/renderer/src/retain/movesWithView.ts
packages/renderer/src/retain/retainedKey.ts
packages/renderer/src/retain/tileCull.ts
packages/renderer/src/spriteSheet.ts
packages/renderer/src/state/GroupState.ts
packages/renderer/src/state/colorMatrix.ts
packages/renderer/src/strokeLengths.ts
packages/renderer/src/targetRect.ts
packages/renderer/src/test-seams.ts
packages/renderer/src/textBounds.ts
packages/renderer/src/textCommand.ts
packages/renderer/src/textLayout.ts
packages/renderer/src/textures/registerTexture.ts
packages/renderer/src/warmPrograms.ts
packages/renderer/src/warnOnce.ts

<!-- done: 1 findings, files read: 38 -->
