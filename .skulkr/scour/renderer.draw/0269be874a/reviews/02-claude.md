# Findings: renderer.draw

## A clip's stencil pop is flattened at a different tolerance than its push, leaving stale clip bits
- where: packages/renderer/src/draw/clip.ts:239 (rasterizePathToStencil)
- scenario: `rasterizePathToStencil` builds the clip mesh with `fillMesh(ctx, path)`, whose tolerance comes from `flattenToleranceOf(ctx)`, i.e. `ctx.state.transform` when it runs, not from the `model` the path is drawn under. Push and pop run under different states in two real cases. (1) `drawGroup` in `draw.ts:44-53`: a group with effects and a curved clip pushes the clip under `state.push({ transform: cmd.transform })` and pops it in `leaveClip` after that state is popped. With `cmd.transform` = scale(4) and the default `{ px }` tolerance, the push flattens the circle 4× finer than the pop. (2) `materializeClips`, run from `flushForOwnDraw`, `enterUncut` or a nested stencil clip under a scaled child group, pushes a rect, hull or plane clip under the child's transform. A curved convex plane clip is the case this hits. The clip is popped later under its own group's transform. In both cases the finer polygon covers pixels between the coarser polygon's chords; `clipPop` never clears the bit there, so it stays set. The next clip pushed at that depth adds its bit only where its own path covers, and draws there test `equal` on the ancestor mask, so they paint in that sliver outside their clip. Push and pop should rasterize the same mesh, flattened for `model`.
- evidence: read (`getMesh` caches per tolerance in `cache/cache.ts:16`; `draw.ts:44-53`)
- severity: medium
- fix: packages/renderer/src/draw/clip.ts
- size: line
- cause: tolerance read from live state instead of the clip's model
- confidence: likely

## drawGroupWithEffects and drawInto leave the context redirected if a child throws
- where: packages/renderer/src/draw/groupEffects.ts:113 (drawGroupWithEffects); packages/renderer/src/draw/retained.ts:151 (drawInto)
- scenario: A child can throw, for example `enterGroupClip` when clips nest past 7 deep, which it does on purpose. Neither function has a `try/finally`, so after the throw `ctx.state` keeps the `pushIsolated` entry, and `ctx.clipStack`, `clipDepth`, `drawBatch.clip`, `projection` and `renderTarget` still point at the offscreen buffer. The pass is left on that buffer, and the targets from `targets.acquire` are never released. `drawGroup` itself pops its state on this same throw (`draw.ts:69-72`), so the two places answer the teardown question differently. A renderer that catches the error and draws the next frame starts from a leaked effects target and a skewed group stack.
- evidence: read
- severity: low
- fix: packages/renderer/src/draw/groupEffects.ts, packages/renderer/src/draw/retained.ts
- size: function
- cause: no finally around child dispatch
- confidence: likely

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

<!-- done: 2 findings, files read: 35 -->
