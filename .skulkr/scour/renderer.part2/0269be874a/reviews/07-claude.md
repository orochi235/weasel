# renderer.part2 findings

## frameRect returns NaN rects for a sheet with `columns: 0`, and a negative or fractional index gives a rect off the grid
- where: packages/renderer/src/spriteSheet.ts:38 (frameRect)
- scenario: `frameRect({ frameWidth: 16, frameHeight: 16, columns: 0 }, 0)` → `0 % 0` is NaN, so `x`/`y` are NaN and the image draws nothing, with no error. `frameRect(sheet, 2.5)` gives `col = 2.5`, a source rect straddling two cells (a half-and-half frame), where the doc only promises "past the last cell" behavior. A sheet built from metadata whose `columns` came out 0 (an image narrower than one frame) fails silently.
- evidence: read
- severity: low
- fix: packages/renderer/src/spriteSheet.ts
- size: line
- cause: unvalidated grid description and index
- confidence: sure

## warmPaintKinds resolves without registering a kind whose loader is disposed while its load runs
- where: packages/renderer/src/paintKinds.ts:300 (startLoad)
- scenario: `warmPaintKinds(['k'])` starts loader L. Before L resolves, its disposer runs with no other loader for `'k'`. In the `then`, `LOADERS.get(id) !== loader`, `live` is undefined, and the callback returns `undefined`, so the warm promise fulfills. `warmPaintKinds` documents that it "resolves once every kind is registered" and rejects for a kind that is "neither registered nor loadable". Here `'k'` is neither, and the caller is told it is ready.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: displaced-loader branch treats "no live loader" as success
- confidence: likely

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

<!-- done: 2 findings, files read: 38 -->
