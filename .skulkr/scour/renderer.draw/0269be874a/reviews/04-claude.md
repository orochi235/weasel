# Findings: renderer.draw

## A stencil clip's push and pop flatten its path at different tolerances, leaving stale clip bits
- where: packages/renderer/src/draw/clip.ts:233 (rasterizePathToStencil), reached from pushClip/popClip
- scenario: `rasterizePathToStencil` takes the mesh from `fillMesh(ctx, path)`, whose tolerance comes from `ctx.state.transform`, not from the `model` the path is drawn under. A clip's push and pop then rasterize different polygons whenever the live state differs between them. In `drawGroup` (`draw.ts:44-53`), a group with effects and a `clip` enters the clip under `ctx.state.push({ transform: cmd.transform })`, pops that state at once, and calls `leaveClip` under the parent's state. Take an ellipse clip (curved, so it gets no rect, hull or plane entry and takes a stencil bit at once) on an effects group scaled 4×. The push flattens it at 1/8 unit and the pop at 1/2, an octave pair apart. The pop's `clipPop` zeroes the bit only where its coarser inscribed polygon covers. Slivers between the two polygons keep bit `d` set after the group ends. The next sibling clip at depth `d` writes its bit with `replace` only where its own path covers, so its children also pass `clipTest(d)` in those slivers, outside their clip. The result should be identical meshes for push and pop, flattened for the clip's own transform.
- evidence: read (clip.ts `rasterizePathToStencil`/`pushClip`/`popClip`, mesh.ts `fillMesh`/`flattenToleranceOf`, draw.ts `drawGroup`)
- severity: medium
- fix: packages/renderer/src/draw/clip.ts, packages/renderer/src/draw/mesh.ts
- size: function
- cause: tolerance read from live state instead of the clip's model
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

<!-- done: 1 findings, files read: 35 -->
