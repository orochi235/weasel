## warmPaintKinds resolves for a kind whose loader was disposed mid-load, though nothing registered it
- where: packages/renderer/src/paintKinds.ts:291 (startLoad)
- scenario: `registerPaintDrawKindLoader('k', load)`, then `warmPaintKinds(['k'])`; the returned disposer runs before `load()` settles and no other loader for `'k'` remains. When the load resolves, `LOADERS.get(id) !== loader`, `live` is undefined, and the callback returns `undefined`, so the warm promise resolves. `warmPaintKinds` documents "Resolves once every kind is registered ... Rejects ... for a kind that is neither registered nor loadable"; here `'k'` is neither, yet the caller is told it is warm and its first frame draws blank.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: displaced-with-no-successor branch treated as success
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

<!-- done: 1 findings, files read: 38 -->
