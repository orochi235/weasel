# Audit round 78 — renderer.part2 findings

## A text layer's cached box goes stale when one of its texts is refilled in place
- where: packages/renderer/src/textBounds.ts:57 (layerBoxOf / textLayerBox)
- scenario: `layerBoxPart` keys the layer's local box on the `texts` array alone, and recomputes it only when the face or text-engine generation moves. `textCommandFromRunsInto` (textCommand.ts:70) refills a `TextDrawCommand` in place — new x/y, new runs — and documents that "anything still holding `cmd` sees the new text". A `text-layer` whose `texts` array holds such a command keeps the box of the old text: the new glyphs' position and extent are never reflected. `commandBox` → culling (`cullDrawCommands`), `contentBox` for retained surfaces, and `tileCull` then treat the moved or longer text as lying where the old one did, so it is culled or clipped out of a retained surface. It should recompute whenever the commands change, or the layer path should refuse the in-place refill.
- evidence: read (`createPart` is a WeakMap on the owner, registry/src/part.ts:12)
- severity: medium

## A text run's stroke whose paint fails to resolve is kept unpainted, where every other painter drops it
- where: packages/renderer/src/textCommand.ts:145 (runsInPoseFrame), also :166 (withPatternsResolved)
- scenario: a text pose whose run stroke is a tile paint that cannot rasterize (no OffscreenCanvas). `commandStroke` (patterns/commandPaint.ts:39) returns `null` for such a stroke unless it carries a marker. `runsInPoseFrame` and `withPatternsResolved` instead keep `{ ...stroke, paint: undefined }`. So the same unresolvable paint gets two answers: on a path it draws no stroke at all, and on text the stroke survives with no paint. `textBox` still grows the text's bounds by that stroke's reach, and the draw path has to guess what a paintless text stroke means. These should use one rule (`commandStroke`).
- evidence: read
- severity: low

## paintToBoundsUnits converts a pattern or gradient whatever its current units
- where: packages/renderer/src/paintToLocalUnits.ts:62 (paintToBoundsUnits)
- scenario: `paintToLocalUnits` converts only a paint whose `units === 'bounds'` (`isBoundsPattern`, `isBoundsGradient`). Its stated inverse rebases every pattern and gradient without checking `units`. Hand it a gradient or pattern that is already `'bounds'` and it is divided by the box a second time. Hand it a `'world'`/`'screen'` paint and it is relabeled `'bounds'`, with coordinates from the wrong space. So the two directions disagree on which paints they apply to. The round trip `paintToBoundsUnits(paintToLocalUnits(p))` is only an identity for paints that started in `'bounds'`.
- evidence: read
- severity: low

## Dots tiles clip a dot wider than half the tile at its edges instead of wrapping it
- where: packages/renderer/src/patterns/tileGeometry.ts:76 (tileGeometry, `dots`)
- scenario: `{ kind: 'dots', size: 6, radius: 4 }` puts one circle of radius 4 at the center of a 6-px tile. It crosses every edge and the canvas cuts it off there. No copy is drawn past the opposite edge, which `chunks` does through `wraps`, so the repeated pattern shows straight seams across each dot. Expected: overlapping round dots, as the SVG form of the same geometry would also fail to show.
- evidence: read
- severity: low

## createTilePattern with a fractional size draws a tile whose period differs from its canvas
- where: packages/renderer/src/patterns/rasterizeTile.ts:5 (rasterizeTile)
- scenario: `createTilePattern({ size: 5.5, draw })` passes the guard (`>= 1`, finite). `new OffscreenCanvas(5.5, 5.5)` truncates to 5×5, but `draw` is handed `5.5`, so shapes laid out to repeat at 5.5 are cut at 5 and the texture shows seams. `tileSize` rounds for the built-ins; the public entry point does not.
- evidence: read
- severity: low

## A tile spec that failed to rasterize is cached as null for good
- where: packages/renderer/src/patterns/resolveSpec.ts:79 (build / resolvePatternSpec)
- scenario: `build` stores `handle = null` in `cache` when `rasterizeTile` returns null. `resolvePatternSpec` treats any non-`undefined` hit as final. A spec first resolved before an OffscreenCanvas 2D context could be had stays null, and its paint is dropped from then on. That applies even after the context becomes available, and the null entries take slots of the 256-entry LRU from real tiles.
- evidence: read
- severity: low

## A movable retained surface drawn straight through on a fractional pan is never marked adrift, so the budget cannot free it
- where: packages/renderer/src/retain/RetainedSurfaces.ts:229 (lookup)
- scenario: the non-movable branch sets `surface.adrift = true` before returning `through`. The movable branch returning `through` for a fractional or refused move does not. `room()` frees only `adrift` surfaces, so the surfaces of groups drawn straight through while panning by fractions keep their full texture and cannot be evicted. Another group's `reserve` is then refused (`declined`) even though freeing those would make room. That contradicts `reserve`'s doc: "frees the surfaces of groups drawn straight through while they move".
- evidence: read
- severity: low

## warmPrograms leaks its WebGL context when setup throws after the context is made
- where: packages/renderer/src/warmPrograms.ts:22 (warmPrograms / start)
- scenario: `start` gets a `webgl2` context, then calls `new WebGLDevice(gl)` and `buildProgram` for each spec. If either throws, the `catch` in `warmPrograms` swallows it without calling `release()`. The context is never lost, and it counts against the browser's live-context limit for the page's lifetime, which is what makes the oldest context (possibly a real renderer's) get dropped.
- evidence: read
- severity: low

## uninstallFakeOffscreenCanvas deletes the global instead of restoring what was there
- where: packages/renderer/src/patterns/test-utils/fakeOffscreenCanvas.ts:75 (uninstallFakeOffscreenCanvas)
- scenario: `installFakeOffscreenCanvas` overwrites `globalThis.OffscreenCanvas` without saving it, and uninstall `delete`s it. In an environment that has a real OffscreenCanvas (a browser project, or a jsdom polyfill installed by setup), teardown removes it for every later test in the worker.
- evidence: read
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

<!-- done: 9 findings, files read: 38 -->
