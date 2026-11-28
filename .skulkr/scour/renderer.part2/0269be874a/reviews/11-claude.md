## A lookup never starts a loader whose `has` answers for its own registry when the draw half is registered elsewhere
- where: packages/renderer/src/paintKinds.ts:250 (getPaintDrawKind)
- scenario: `@weasel-js/paint-kinds` declares a loader for `'x'` with `has: (k) => KINDS.has(k)` over its own registry, and the draw half for `'x'` is registered directly with `registerPaintDrawKind`. `PaintDrawKindLoaderOptions.has` says "a draw half registered elsewhere still loads it", and `warmPaintKinds` does consult `loader.has`. But `getPaintDrawKind` starts a load only when `KINDS.get(id)` misses, so the first-use lookup never loads the full kind. Its paint-kinds half (its value conversion, etc.) stays absent until someone calls `warmPaintKinds`. The two paths answer "does this kind need loading" two different ways.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: lookup tests KINDS, not loader.has
- confidence: likely

## A `chunks` tile with a large `size` hangs building its geometry, on both the raster and the SVG path
- where: packages/renderer/src/patterns/tileGeometry.ts:86 (tileGeometry, case 'chunks')
- scenario: `{ kind: 'chunks', color, size: 100000 }` gives `wanted = round(1e10 * 0.35 / 9) ≈ 3.9e8`. The cap `Math.min(wanted, s * s)` is 1e10, so it does not bite. The loop then pushes hundreds of millions of ellipse shapes, each with up to four wrap copies, and hangs or runs out of memory. `@weasel-js/svg` calls `tileGeometry` directly, so an export hangs as well. `size: 10000` already builds about 4 million shapes. `rasterizeTile` has no size cap of its own either, so it allocates a canvas of `size × size` first. The comment's own concern ("only hangs") is still reachable: the cap is in pixels, not in a shape count a tile can afford.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/tileGeometry.ts, packages/renderer/src/patterns/rasterizeTile.ts
- size: function
- cause: chunk count capped by tile area, not bounded
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
