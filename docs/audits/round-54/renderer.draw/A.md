# Audit round 54 — renderer.draw — blind reviewer findings

## Emoji in text with a gradient or pattern fill ignore the fill's opacity
- where: packages/renderer/src/draw/colorGlyphs.ts:26 (drawColorGlyphs)
- scenario: a text run filled with `{ kind: 'linear-gradient', …, opacity: 0.5 }` that holds an emoji. `opacity = isSolidPaint(fill) ? solidColor(fill)[3] : 1` gives the emoji opacity 1, so it is drawn fully opaque while the letters beside it are drawn at half (`bindGradient` sets `u_opacity` from `fill.opacity`, paintBind.ts:136). The same holds for a `texture` fill (`bindPattern` sets `u_opacity`, paintBind.ts:111) and for a registered paint kind. The function's own doc says color glyphs "take nothing from the text's fill but its opacity". Every `Paint` variant carries `opacity` (paint/src/paint.ts:27-39). The non-solid branch should read `fill.opacity ?? 1`.
- evidence: read
- severity: low

## Without batchVariants, a run that collects two color matrices is drawn with the single-matrix program
- where: packages/renderer/src/draw/flushBatch.ts:47 (flushBatch); packages/renderer/src/draw/batchMatrices.ts:34 (matrixIndex)
- scenario: a DrawContext with no `batchVariants` (drawContext.ts:30-34: "Absent where a caller drives the draw functions without a renderer behind them, which then draws every run with batchFill"). Two image quads are staged under two different non-diagonal color matrices. `matrixIndex` caps a run at `BATCH_MATRIX_SLOTS` whenever `colorFolding.enabled` is on, without asking whether a multi-matrix program exists, so both quads join one run with matrix indices 0 and 1. `flushBatch` then falls back to `ctx.batchFill`, and `uploadBatchMatrices` writes two entries into a program that declares one. The second quad is drawn under the wrong matrix, or the write fails. Either `runTakes` should cap the run at 1 matrix when `batchVariants` is absent, or the fallback should flush per matrix.
- evidence: read
- severity: low

## Text decorations and outline-tier glyphs are built as float32 world coordinates with no mesh origin, so they shift away from their glyphs far from the origin
- where: packages/renderer/src/draw/text.ts:151 (ruleMesh), text.ts:93/102 (drawTextOutlineGroup → outlineGroupMesh)
- scenario: a text command at x = 10,000,000 with an underline and a texture or gradient fill, viewed at 8× zoom. `drawTextDecorations` builds the rule as `ruleMesh(d.x0 + dx, …)`: a `Float32Array` of absolute world coordinates. A float32 there has a 1-unit step, so the rule's ends snap to whole units, up to 8 screen px off at 8×. The atlas glyphs it underlines are placed by `pushGlyph` from relative quads plus `dx`/`dy` in doubles, so they do not snap, and the rule visibly misaligns with them. The renderer already has the fix for this: `Mesh.origin`, which `setProjAndModel`/`atMeshOrigin` and the batch's mesh push honor (uniforms.ts:129-147). `ruleMesh` sets no origin. The outline tier does the same: `outlineGroupMesh(group, dx, dy)` writes world positions into a `Float32Array` (glyphOutlineMesh.ts:109) with no origin, and the outline tier is exactly the one used when glyphs are large on screen, which is where the error shows. Solid-filled rules are unaffected, because they go through `pushRect` with doubles.
- evidence: read (the snapping is float32 arithmetic; not rendered)
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
