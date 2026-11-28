## A `'bounds'` paint of a lazily loaded kind passes through unconverted until the kind lands, and stays that way in memoized commands
- where: packages/renderer/src/paintToLocalUnits.ts:24 (paintToLocalUnits), :58 (paintToBoundsUnits)
- scenario: a kind declared with `registerPaintDrawKindLoader` and a node filled `{ kind: 'mykind', units: 'bounds', ... }`. The first `commandPaint` runs before the load lands: `getPaintDrawKind` starts the load and returns `undefined`, so `toLocalUnits` is skipped and the paint comes back still in `'bounds'` units, 0..1 fractions. A painter that memoizes its commands keeps that command. Once the kind lands, its `bind` receives a paint whose geometry is box fractions read as local coordinates, so it draws squeezed into a 1×1 unit square at the origin instead of across the node. It should draw at the node's box. The same happens in reverse in `paintToBoundsUnits`, where an editor normalizing a paint gets back the local paint unchanged.
- evidence: read
- severity: medium
- fix: packages/renderer/src/paintToLocalUnits.ts, the painters' memo (or have the converted result mark itself unresolved, e.g. return `null` and drop the fill until the kind is known)
- size: function
- cause: frame conversion silently skipped for a known-but-unloaded kind
- confidence: likely

## A second loader declared after the first one's kind has landed is never called, contrary to its doc
- where: packages/renderer/src/paintKinds.ts:248 (registerPaintDrawKindLoader doc), :220 (getPaintDrawKind)
- scenario: `registerPaintDrawKindLoader('k', loadA)`. A lookup loads A and registers its draw half. Then `registerPaintDrawKindLoader('k', loadB)`. The doc says "Declaring a second loader for an id overrides the first, whether or not the first has started or failed: the next lookup calls the new one". But `getPaintDrawKind` finds A's entry in `KINDS` and never calls `startLoad`, and `warmPaintKinds(['k'])` skips it because `loader.has('k')` is true, so B never runs and A's draw half keeps drawing. Either the doc should say a landed first loader keeps its kind until disposed, or declaring B should drop the kind A registered.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: doc and lookup disagree on an override after a landed load
- confidence: sure

## A revived pattern tile can differ from the one first drawn: JSON turns NaN and Infinity fields into null
- where: packages/renderer/src/patterns/resolveSpec.ts:45 (specId), :117 (revive)
- scenario: a dots spec `{ kind: 'dots', color: 'red', radius: NaN }`. The first build sees `radius` NaN, `!(r >= 0)` holds, and the tile is empty. The id is `JSON.stringify`, so the id holds `"radius":null`. After eviction (more than 256 specs, or a public `unregisterTexture`), `getTexture` revives it from the id: `radius` is now `null`, `spec.radius ?? 1` gives 1, and the same handle draws a dot grid. The same goes for `lineWidth: Infinity` (revived as the default width) and `size: Infinity`. A handle should draw the same tile before and after eviction. Also, two specs that draw differently (`radius: NaN` vs `radius: null`) share one id.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/resolveSpec.ts
- size: function
- cause: lossy JSON encoding used as the rebuild key
- confidence: sure

## `createTilePattern`'s doc says it returns null only without an OffscreenCanvas, but a size under one pixel returns null too
- where: packages/renderer/src/patterns/index.ts:25 (createTilePattern doc)
- scenario: `createTilePattern({ size: 0.4, draw })` or `size: NaN`. `rasterizeTile` returns `null` at its first guard, so `createTilePattern` returns `null` while an `OffscreenCanvas` is available. The doc ("Returns `null` only when an `OffscreenCanvas`/2D context can't be acquired") tells a caller that null means no canvas. The same applies to `hatch`/`dots`/... with `size: 0`.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/index.ts
- size: line
- cause: stale doc
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

<!-- done: 4 findings, files read: 38 -->
