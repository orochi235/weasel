I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole findings document is below. One more thing to know first: commit `1b4edb3a…` isn't in this clone. I read the checked-out tree at `6f634fabe1` instead (`packages/renderer/src/draw` has no local changes), and the line numbers refer to that.

# Audit round 63 — renderer.draw

## A far-off rect's aligned stroke drawn through the stencil marks its fill at the wrong place
- where: packages/renderer/src/draw/pathPaint.ts:133 (drawPathStroke) and :248-262 (drawPathStrokeStenciled)
- scenario: Take a `rect` path far enough from 0 that `tessellateRect` gives its fill mesh an `origin`, with vertices measured from that origin. Give it `stroke.align: 'inner'` (or `'outer'`) where `ribbonAligns` is false, for example an inner stroke wider than the rect can hold or a metric that turns it. Add `stroke.vertexColors`, or draw on a target with `batchVariants.cuts === false`, so `cutAlignedRibbon` returns null. `drawPathStroke` then enters `atMeshOrigin` with `cmd.path.kind === 'polygon' ? cmd.path.origin : undefined`, which is undefined for a rect. `drawPathStrokeStenciled` draws `fillMeshHandle(ctx, cmd.path)` under a model with no origin, so the ALIGNED_FILL mark on stencil bit 0 lands offset by the whole mesh origin. The ribbon comes from `ribbonMesh`, which gives a rect no origin, so it is placed correctly but tested against a mark that sits somewhere else. An inner stroke paints nothing and an outer one paints the whole doubled ribbon. The fill pass should be drawn under `fillMesh(ctx, path).origin`, as `drawPathFill` does with `atMeshOrigin(mesh.origin)`, and the ribbon under its own mesh's origin. The CPU path already reconciles the two origins in `alignedRibbon.outlinePlanes` and `triangleCut.buildTriangles`.
- evidence: read (geom/src/tessellate/tessellate.ts:34-44 gives a rect mesh an origin; stroke/src/tessellate/stroke.ts:182 gives a rect ribbon none)
- severity: medium

## A typed-array value for a uniform that isn't an array is silently dropped
- where: packages/renderer/src/draw/customShader.ts:40-86 (setUniform), reached from setUniforms:138
- scenario: `ShaderUniform` admits `Int32Array` and `Uint32Array`, and `setUniforms` sends them to the array path only when `program.array(name)` exists. For a scalar `uniform ivec2 u_cell`, the value `new Int32Array([3, 4])` reaches `setUniform`. It isn't a texture, a handle, a `Float32Array` or an `Array`, and it isn't a number, so nothing is written. There is no warning and no dev throw, unlike the `Float32Array` and `Array` branches, which throw in dev on a length they don't take. The uniform keeps its old value. It should write an `ivecN`/`uvecN` of matching length, or report the value as other bad values are reported.
- evidence: read
- severity: low

## A text layer that falls back after uploading a span keeps that span's GPU buffers
- where: packages/renderer/src/draw/textLayer.ts:141-170 (TextLayers.build)
- scenario: The texts use more than `ATLAS_SLOTS` (14) distinct atlases, so `close()` uploads a span part-way through. A later text in the same array then has a stroke, a decoration, a color or outline group, or a non-solid fill, and `build` returns `withFallback(layer)` with that span still in `layer.spans`. `drawLayer` returns false for a fallback layer every frame, so the span is never drawn. Because `layerFor` touches the layer every frame it's drawn, `endFrame` never frees it either. Its instance buffer and geometry stay allocated for as long as the layer is in use. The early returns should free the spans already uploaded, or `build` should check for fallback before uploading anything.
- evidence: read
- severity: low

## Files read
packages/renderer/src/draw/alignedRibbon.ts
packages/renderer/src/draw/batch.ts
packages/renderer/src/draw/batchMatrices.ts
packages/renderer/src/draw/batchRun.ts
packages/renderer/src/draw/clip.ts
packages/renderer/src/draw/clippedTrim.ts
packages/renderer/src/draw/colorGlyphs.ts
packages/renderer/src/draw/cornersResolved.ts
packages/renderer/src/draw/customShader.ts
packages/renderer/src/draw/drawContext.ts
packages/renderer/src/draw/drawTriangles.ts
packages/renderer/src/draw/effects.ts
packages/renderer/src/draw/flattenTolerance.ts
packages/renderer/src/draw/flushBatch.ts
packages/renderer/src/draw/foldColor.ts
packages/renderer/src/draw/gradient.ts
packages/renderer/src/draw/groupEffects.ts
packages/renderer/src/draw/idComposite.ts
packages/renderer/src/draw/idFrame.ts
packages/renderer/src/draw/idRender.ts
packages/renderer/src/draw/image.ts
packages/renderer/src/draw/mesh.ts
packages/renderer/src/draw/modelScale.ts
packages/renderer/src/draw/paintBind.ts
packages/renderer/src/draw/pathPaint.ts
packages/renderer/src/draw/patternBatch.ts
packages/renderer/src/draw/quad.ts
packages/renderer/src/draw/retained.ts
packages/renderer/src/draw/scratchPass.ts
packages/renderer/src/draw/stencil.ts
packages/renderer/src/draw/text.ts
packages/renderer/src/draw/textLayer.ts
packages/renderer/src/draw/triangleCut.ts
packages/renderer/src/draw/uniforms.ts
packages/renderer/src/draw/vertexColors.ts

<!-- done: 3 findings, files read: 35 -->