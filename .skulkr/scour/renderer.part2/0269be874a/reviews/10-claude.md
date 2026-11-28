## A lazily loaded paint kind's `'bounds'` paint passes through unconverted when painted before its loader lands
- where: packages/renderer/src/paintToLocalUnits.ts:25 (paintToLocalUnits)
- scenario: a kind declared with `registerPaintDrawKindLoader` and not yet warmed; a node painter calls `commandPaint` on a `{ kind: 'mykind', units: 'bounds', ... }` fill. `getPaintDrawKind` returns `undefined` (it only starts the load), so the fill comes back with its `0..1` geometry and `units: 'bounds'` as if it were already in the box's frame. A painter memoizing its commands per node keeps that command after the kind lands, so the paint draws with box-fraction coordinates in local space (a tiny gradient at the box's origin) until the node changes; it should convert once the kind is known, or decline the paint until then. `paintToBoundsUnits` (line 59) has the same hole in the other direction.
- evidence: read
- severity: medium
- fix: packages/renderer/src/paintToLocalUnits.ts, packages/renderer/src/patterns/commandPaint.ts
- size: function
- cause: missing kind treated as identity conversion
- confidence: likely

## `chunks` tile geometry is bounded by the tile's pixel count, which a large `size` makes millions of shapes
- where: packages/renderer/src/patterns/tileGeometry.ts:83 (tileGeometry, `chunks` case)
- scenario: `{ kind: 'chunks', color, size: 4096, chunkSize: 0.05 }` (a spec from JSON): `wanted` ≈ 4096²·0.35/0.0025 ≈ 2.3e9, capped at `s * s` = 16.7M, so `tileGeometry` builds ≥16.7M ellipse objects (more with wraps) and `drawTileShapes` fills each; the main thread stalls for a long time, as does `@weasel-js/svg` emitting the same shapes. The cap's own comment says it is there so the scatter "only hangs" no longer, but at large sizes it still does. A cap independent of `s` (or of coverage saturation, e.g. once `count·chunkArea` exceeds a few multiples of `s²`) would bound it.
- evidence: read
- severity: low
- size: line
- cause: cap scales with tile area
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
