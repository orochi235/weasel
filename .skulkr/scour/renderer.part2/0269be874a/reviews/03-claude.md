# renderer.part2 findings

## A displaced loader's failed load rejects `warmPaintKinds` even though the live loader would load the kind
- where: packages/renderer/src/paintKinds.ts:303 (startLoad)
- scenario: `registerPaintDrawKindLoader('x', L1)`; `warmPaintKinds(['x'])` starts L1's load. Before it settles, `registerPaintDrawKindLoader('x', L2)` overrides it. If L1 then resolves, the success handler sees it was displaced and chains `startLoad` onto L2, so the warm resolves once L2 lands. If L1 rejects instead, the rejection handler (`failed`) only logs and rethrows: the warm rejects, `console.error` reports a failure for a loader nothing uses any more, and L1's `started` keeps the rejection. So if L2 is later disposed and L1 uncovered, L1 is never tried again. The doc promises that a load the old loader finishes afterward is ignored, but this path decides displacement only on success.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: function
- cause: displacement check only in the fulfilled branch
- confidence: likely

## A chunks tile stops at the first chunk wide enough to cover it, so later chunks are dropped under a translucent color
- where: packages/renderer/src/patterns/tileGeometry.ts:96 (tileGeometry, `chunks`)
- scenario: take `{ kind: 'chunks', color: 'rgba(0,0,0,0.3)', size: 4, chunkSize: 12 }`. A chunk's minor half-axis can reach `s·√2`, so a chunk in the middle of the list returns at once with a full-tile rect, and every chunk after it is never emitted. With an opaque color that changes nothing. With a translucent one, each later chunk should darken the tile again where it lands, so the tile comes out lighter and more uniform than drawing every chunk would make it. The comment says only that the earlier chunks stay under the rect. Raster and SVG agree because they share this geometry, but both are wrong next to the unshortened scatter.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/tileGeometry.ts
- size: line
- cause: early return drops the remaining chunks
- confidence: likely

## `textBoxOf` spreads every line into `Math.min`, which throws on very long text
- where: packages/renderer/src/textCommand.ts:174 (textBoxOf)
- scenario: build a `textCommandFromRuns` text with no `width` or finite `maxWidth`, a `'bounds'` gradient fill, and more lines than the engine allows as call arguments (about 10⁵ or more, as in a log view). Then `Math.min(...lines.map((l) => l.x0))` throws a `RangeError` and the whole command fails to build. A loop over the lines would give the same minimum.
- evidence: read
- severity: low
- fix: packages/renderer/src/textCommand.ts
- size: line
- cause: argument spread over an unbounded array
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

<!-- done: 3 findings, files read: 38 -->
