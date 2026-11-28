# renderer.part2 findings

## A displaced paint-kind loader that fails rejects the warm-up instead of handing over to the live loader
- where: packages/renderer/src/paintKinds.ts:300 (startLoad)
- scenario: `warmPaintKinds(['k'])` starts loader L1 for `'k'`. Before it settles, `registerPaintDrawKindLoader('k', L2)` overrides it. If L1 then resolves, the displaced branch clears `L1.started` and chains to `startLoad('k')` for L2, so the warm-up waits on L2. If L1 instead rejects, or resolves to an entry with the wrong `id` (checked before the displacement test), `failed` rethrows. `warmPaintKinds` then rejects with L1's error, although L1 no longer answers for `'k'` and L2 was never started. `L1.started` also stays set to the rejected promise, so if L2 is disposed and L1 is uncovered, L1 is never retried. The resolve path explicitly allows that retry ("this one loads again should it be uncovered"). Expected: the displaced-loader handling runs on both outcomes, and the warm-up follows the live loader.
- evidence: read
- severity: low
- size: function
- cause: displacement check only on the fulfilled path
- confidence: likely

## `getPaintDrawKind` starts a load that the loader's own `has` says is not needed
- where: packages/renderer/src/paintKinds.ts:228 (getPaintDrawKind)
- scenario: A package registers a loader with a custom `register`/`has` pair, which fills its own registry. `has('k')` returns true, but no draw half is in `KINDS`. Every lookup sees `!entry && LOADERS.has(id)` and calls `startLoad`, which runs `loader.load()`, importing the chunk. Only after that does it notice `loader.has(id)` and register nothing. `warmPaintKinds` asks the same question through `loader.has(id)` and skips the load. So whether the kind "has landed" gets two different answers on the two paths, and the loader runs although its docs say "Whether the kind has landed, so needs no load".
- evidence: read
- severity: low
- size: line
- cause: lookup tests KINDS instead of loader.has
- confidence: likely

## Reviving an evicted pattern tile ignores the failed-rasterize memo, so it retries a canvas every draw
- where: packages/renderer/src/patterns/resolveSpec.ts:118 (revive)
- scenario: A draw command holds a `pattern:` handle whose tile was evicted (more than `PATTERN_TILE_CACHE_LIMIT` specs, or a public `unregisterTexture`). Rasterizing that spec now fails, for example because `getContext('2d')` returns null under canvas-memory pressure. Every `getTexture` miss calls `revive` → `build`, which allocates a new `OffscreenCanvas` and fails again. That repeats on every lookup of every frame. `resolvePatternSpec` checks `failed` (keyed by `failedUnder`) to stop exactly this, but `revive` never consults it. Expected: `revive` returns early for an id in `failed` under the same `OffscreenCanvas`, as `resolvePatternSpec` does.
- evidence: read
- severity: low
- size: line
- cause: failed memo checked on one entry path only
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
