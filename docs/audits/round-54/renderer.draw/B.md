I couldn't save the findings file: the first write of `.skulk/out/findings.md` worked, but later writes were refused permission, so the file on disk only has its header. The full document is below.

The checkout is at HEAD 830b463cc1, not the commit the brief names (608f35f5), so every path is cited against HEAD.

# Audit round 54 — renderer.draw findings

## A group's color matrix never reaches a registered paint kind, on paths or on glyphs
- where: packages/renderer/src/draw/paintBind.ts:53 (bindPaintKind); packages/renderer/src/draw/scratchPass.ts:89 (bindScratchPaint); packages/renderer/src/draw/text.ts:286 (drawPaintedGlyphs)
- scenario: a group carries a `colorMatrix`, say grayscale. Inside it are a path and some atlas text, both filled with a registered paint kind.
  - Every built-in paint gets the matrix: `bindPathFillSolid`, `bindPattern` and `bindGradient` call `setColorMatrixUniforms`, and the batch folds it on the CPU.
  - `bindPaintKind` sets only the projection, the model and the kind's own uniforms. `PaintBindContext` (paintKinds.ts) exposes `alpha` but no color matrix, so a kind has no way to apply it.
  - For glyphs, `bindScratchPaint` binds no color matrix either, and `TEXTURE_PAINT_GLSL` (shaders/glyphPaint.ts) has none.

  The registered-kind fill therefore stays in full color while its solid, gradient and pattern siblings in the same group go gray. The group's matrix should reach these draws too.
- evidence: read
- severity: medium

## A Float64Array value for an array uniform is rejected, though the uniform table says it reads as a Float32Array
- where: packages/renderer/src/draw/customShader.ts:90 (isArrayValue), :59–68 (setUniform)
- scenario: a shader command passes `uniforms: { u_pts: new Float64Array(8) }` for `uniform vec2 u_pts[4]`.
  - `ShaderUniform` admits `Float64Array`, and registerProgram.ts documents it as "the Float32Array of its values". A `Float32Array(8)` fills the array through `setUniformArray`.
  - `isArrayValue` leaves `Float64Array` out, so the value falls through to `setUniform`. That converts it but accepts only lengths 9 and 16, so it throws a `TypeError` in dev and is silently dropped in production.
  - The same happens to `mat3 u_m[2]` given `Float64Array(18)`, which is a kit-matrix-shaped value.

  `isArrayValue` should accept a Float64Array and convert it, as `setUniform` does.
- evidence: read
- severity: low

## A group with effects whose color matrix lowers alpha still claims picking ids at its unmapped alpha
- where: packages/renderer/src/draw/idComposite.ts:29 (compositeIds), called from packages/renderer/src/draw/groupEffects.ts:163
- scenario: an id frame draws a group that has `effects` and a `colorMatrix` whose alpha row scales alpha down (row 4 `[0,0,0,0.1,0]`, or all zeros to hide it).
  - The color composite applies the matrix, so the group draws faint or not at all.
  - `compositeIds` passes `colorMatrix: IDENTITY`, and its shader claims every pixel where `texel.a * u_alpha >= minAlpha`.

  So the group wins picks on pixels it no longer visibly paints. The id test should use the alpha the color composite actually lands.
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