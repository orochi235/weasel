# renderer.part2 findings

## A tile paint's `size` has no upper bound, so a large one allocates a canvas that size and a `chunks` tile can hang building its shapes
- where: packages/renderer/src/patterns/tileGeometry.ts:76 (tileGeometry, `chunks` case); packages/renderer/src/patterns/rasterizeTile.ts:5 (rasterizeTile)
- scenario: a document deserialized with `{ kind: 'chunks', color: '#000', size: 100000 }`. `tileSize` gives 100000. `rasterizeTile` creates `new OffscreenCanvas(100000, 100000)`; nothing checks it against a texture size limit. Then `tileGeometry` caps the chunk count at `s * s` (1e10), which does not bind here: `wanted = s²·0.35/9 ≈ 3.9e8`. The loop pushes hundreds of millions of ellipse shapes (up to 9 copies each with wraps) and the tab hangs or runs out of memory. The same `tileGeometry` call runs for SVG export. The cap's own comment says it exists to stop hangs ("past that a scatter covers nothing more, and only hangs"), but it only bounds small tiles. Expected: the tile side is clamped (or the paint declined) at a bound such as the max texture side, and the shape count is bounded in absolute terms.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/tileGeometry.ts, packages/renderer/src/patterns/rasterizeTile.ts
- size: function
- cause: tile size unbounded; shape cap scales with size²
- confidence: likely

## `textBoxOf` spreads every line into `Math.min`, which throws RangeError for text with very many lines
- where: packages/renderer/src/textCommand.ts:174 (textBoxOf)
- scenario: `textCommandFromRuns` with a `'bounds'` gradient fill, no `width`, and no finite `maxWidth`, on a string with about 150k lines (a log dump or a pasted CSV). `Math.min(...lines.map((l) => l.x0))` passes one argument per line, goes past the engine's argument limit, and throws `RangeError: Maximum call stack size exceeded`. Building the command then fails, when it should return a box. Expected: a loop that tracks the minimum.
- evidence: read
- severity: low
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

<!-- done: 2 findings, files read: 38 -->
