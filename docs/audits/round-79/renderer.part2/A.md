## A tile that failed for want of an OffscreenCanvas is never retried once another spec fails under the new canvas
- where: packages/renderer/src/patterns/resolveSpec.ts:76 (resolvePatternSpec), :96 (build)
- scenario: spec A (a valid hatch) is resolved before `OffscreenCanvas` exists (SSR, a polyfill installed late) and goes into `failed`, `failedUnder = undefined`. The canvas is installed. Spec B, which fails under any canvas (an unknown kind, or `size: 0`), is resolved first: it is not in `failed`, so nothing is cleared, and `build` sets `failedUnder` to the new canvas. Now resolving A finds `failed.has(A)` and `failedUnder === canvasNow()`, and returns `null` without rasterizing. The hatch fill is dropped for good, though A was never tried under this canvas. One global `failedUnder` stands for every entry in `failed`, but entries from different canvases share the set. It should store the canvas per id, or clear `failed` whenever `failedUnder` changes in `build`.
- evidence: read
- severity: medium

## movesWithView's memo goes stale when a text command is refilled in place, though textBounds tracks exactly that
- where: packages/renderer/src/retain/movesWithView.ts:20 (movesWithView), :44 (commandMoves 'text-layer'/'text')
- scenario: a text-layer's `texts` array holds a command that `textCommandFromRunsInto` rewrites each frame (textCommand.ts:68). Frame 1's run paint is solid, so the memo keyed by `texts` (and by the enclosing `children` array) records `true`. A later refill gives the run a `'screen'`-unit gradient (the default units), and paints should then stay fixed on screen through a pan. The memo still answers `true`, so a retained surface is composited shifted, and the gradient slides with the content. textBounds.ts answers the same question ("was this command rewritten in place?") through `noteTextRefill` / `refilledAt` and invalidates its per-array cache. movesWithView ignores it, so the two caches handle in-place refills in two different ways.
- evidence: read (the retained key's `children` identity check also misses this; I did not trace whether the renderer re-keys on refill)
- severity: low

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
