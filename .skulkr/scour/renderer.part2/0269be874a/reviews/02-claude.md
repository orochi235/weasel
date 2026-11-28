# renderer.part2 findings

## chunks tile stops scattering at the first tile-covering chunk, dropping every later chunk
- where: packages/renderer/src/patterns/tileGeometry.ts:89 (tileGeometry, `chunks` case)
- scenario: a `chunks` spec with a large `chunkSize` and a translucent `color` (e.g. `#0008`), where chunk k of N is wide enough to cover the tile. The loop `return`s at chunk k, so chunks k+1..N, which would stack over the covering rect and darken it, are never emitted. The raster and SVG tiles then show a lighter tile than drawing every chunk would. The comment only accounts for the chunks drawn before it ("what it covers stays under it"), not for the ones after.
- evidence: read
- severity: low
- size: line
- cause: early return in place of a cap on the remaining chunks
- confidence: likely

## TileTextures.release never evicts from the tile's own size, even when that size was freed into longest ago
- where: packages/renderer/src/retain/TileTextures.ts:96 (release)
- scenario: the pool is full (16 textures) and the size being released is the least recently freed-into size. `this.pool.delete(tile.size)` runs before `this.pool.entries().next()`, so the eviction skips that size and frees a texture of the next-oldest size. The released size then moves to newest. The doc says it frees "one of the size freed into longest ago", but a size that is freed into repeatedly keeps its textures while other sizes are drained.
- evidence: read
- severity: low
- size: line
- cause: deleting the map key before picking the oldest
- confidence: sure

## createTilePattern rejects a size below 1 that its options say is rounded to whole pixels
- where: packages/renderer/src/patterns/rasterizeTile.ts:6 (rasterizeTile)
- scenario: `createTilePattern({ size: 0.6, draw })`. `TilePatternOptions.size` is documented as "rounded to whole ones", which gives 1, but the guard `opts.size >= 1` runs on the unrounded value and returns `null`. `tileSize()` rounds before this check, so built-in specs are not affected; direct callers are.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/rasterizeTile.ts, packages/renderer/src/patterns/index.ts
- size: line
- cause: guard checks the value before rounding
- confidence: sure

## cullToTile builds new group objects and children arrays for every tile of every redraw, so caches keyed on array identity miss
- where: packages/renderer/src/retain/tileCull.ts:55 (cullToTile)
- scenario: a retained group bigger than `RETAIN_TILE` holds nested groups that are partly culled per tile. Each redraw (draw/retained.ts:167) spreads `{ ...cmd, children }` again. `movesWithView`'s WeakMap memo, `latestTextRefillIn`'s `textsOf`/`latestPart` parts, and any `RetainedKey.children` comparison for a nested group all key on those arrays, so they recompute (walk and collect again) on every tile of every redraw, and never hit.
- evidence: read (caller in draw/retained.ts:140–167)
- severity: low
- fix: packages/renderer/src/retain/tileCull.ts
- size: function
- cause: culled copies are not memoized per tree and tile
- confidence: likely

## commandsBounds adds the CSS-pixel cull slack in whatever units its transform maps into
- where: packages/renderer/src/retain/contentBounds.ts:99 (commandsBounds)
- scenario: `snapOut(listBox(...), 1)` grows the box by `CULL_SLACK_PX` units of the target space. That slack is meant as CSS pixels, and `commandsBounds` documents a `scale` (device pixels per unit) that it passes only to `listBox`. With a page in units 10× larger than device pixels (scale 0.1), the slack is ten times what it should be; with scale 10, a tenth.
- evidence: read
- severity: low
- size: line
- cause: snapOut given a scale of 1 rather than the slack converted to units
- confidence: likely

## _resetPaintDrawKindsForTests leaves registered kinds' programs in the program registry
- where: packages/renderer/src/paintKinds.ts:371 (_resetPaintDrawKindsForTests)
- scenario: a test registers kind `x` declaring program `p`, then calls the reset. `PROGRAMS_HELD` is cleared but `p` stays in `programSourceRegistry`. A later test registering kind `x` with different source for `p` throws `ExtensionConflictError`, because `heldByKind` no longer knows a kind holds `p`. Whether it throws depends on test order, unless every caller also resets the program registry.
- evidence: read
- severity: low
- size: line
- cause: the reset drops the bookkeeping without running the releases
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

<!-- done: 6 findings, files read: 38 -->
