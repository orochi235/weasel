The write to `.skulk/out/findings.md` was refused, so the whole findings document is below instead.

## A text layer's memoized box never sees a font arrive, so it bounds the layout from before the face loaded
- where: packages/renderer/src/textBounds.ts:52 (layerBoxOf / textLayerBox)
- scenario: a stroke-free `TextLayerDrawCommand` is drawn before its face is registered, or before a face that changes the metrics loads. `layerBoxOf` is a `createPart` WeakMap on the `texts` array, so the box from that first layout is kept for as long as the array lives.
  - `cachedLayoutRuns` re-lays the same runs when `faceGeneration()` moves (text/src/layout/layoutCache.ts:204).
  - `DrawCommand.ts:196-198` tells callers to keep `texts` unchanged across frames, and says the layer is uploaded again when a glyph becomes available.
  - So once the font loads, the glyphs are drawn at the new advances while `textLayerBox` still returns the old box.
  - That box feeds `cullDrawCommands` (cullDrawCommands.ts:73) and, through `commandBox`, the retained `contentBox`/`boxTree`. Text that now reaches past the old box is culled, or clipped out of its retained surface.
  - If the first layout placed no glyph, the memo is `null`, and a retained surface sizes that layer as `EMPTY` from then on.
  - The memo should also be keyed on the face generation, the way the layout cache is.
- evidence: read
- severity: medium

## `chunks` tile has no bound on its scatter count, so a small `chunkSize` or a large `density` hangs the resolve
- where: packages/renderer/src/patterns/tileGeometry.ts:76 (tileGeometry, case 'chunks')
- scenario: `{ kind: 'chunks', color, chunkSize: 0.01 }` at the default size 48 and density 0.35 gives `wanted = 48²·0.35/0.0001 ≈ 8.1M`.
  - Each chunk can push up to 4 ellipses, so this builds about 30M shape objects, synchronously, inside `resolvePatternSpec` on the paint path. The tab freezes or runs out of memory.
  - `density: 1e6` does the same.
  - Both are serializable paint fields, so a slider or a loaded document can produce them.
  - The only guards are `chunkSize > 0` and finiteness; nothing caps `count`, for example at the tile's pixel count.
- evidence: read
- severity: medium

## A fractional tile `size` is rasterized on a truncated canvas but drawn for the fractional size, so the raster tile seams and drifts from the SVG one
- where: packages/renderer/src/patterns/rasterizeTile.ts:10 (rasterizeTile); packages/renderer/src/patterns/tileGeometry.ts:27 (tileSize)
- scenario: `{ kind: 'hatch', color, size: 5.5 }`.
  - `tileSize` returns 5.5 as given, and `rasterizeTile` accepts any finite size ≥ 1.
  - `new OffscreenCanvas(5.5, 5.5)` makes a 5×5 canvas, but `tileGeometry` places the diagonals and stubs for a 5.5 tile.
  - The bitmap repeats every 5 px, so the diagonals don't meet at the tile edges and every tile shows a seam.
  - The SVG export maps the same geometry onto a 5.5-unit `<pattern>`, so raster and vector disagree. Keeping them in step is the stated purpose of tileGeometry.ts:1-8.
  - The size should be rounded once in `tileSize`, or rejected.
- evidence: read
- severity: low

## `keepKey` copies the key's matrices against later in-place writes but keeps effect uniforms by reference, so an effect uniform updated in place matches the stale surface
- where: packages/renderer/src/retain/retainedKey.ts:33 (keepKey), :90 (sameEffects)
- scenario: a retained group has `effects: [{ program, uniforms: { u_amount: amountArray } }]`. Its owner writes a new value into `amountArray` (a `Float32Array`) between frames and passes back the same effect list.
  - `keepKey` keeps `effects` as the caller's own objects, so the kept key and the new key share one uniform array.
  - `sameUniform` then compares the array with itself, so `sameKey` is true and the surface composites the old pixels.
  - `keepKey` copies `transform`, `colorMatrix`, `viewMatrix`, `screenMatrix` and the clip transforms for exactly this case ("no later write to the caller's matrices reaches"). Typed-array uniforms, which `sameEffects` deliberately compares by value, are left out of that protection.
- evidence: read
- severity: low

## Files read
packages/renderer/src/meshPaint/surface.ts
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
packages/renderer/src/warnOnce.ts

<!-- done: 4 findings, files read: 36 -->