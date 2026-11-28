## A clip's stencil mesh is flattened at the tolerance of whatever transform is live, not the clip's own, so push and pop can rasterize different polygons
- where: packages/renderer/src/draw/clip.ts:221 (rasterizePathToStencil)
- scenario: a convex curved clip (a circle on a target where the shader decides no hulls, so it becomes a `planes` entry with no bit) is entered under group transform T. A child group scaled 8× draws something that draws for itself, so `flushForOwnDraw` → `materializeClips` → `pushClip(ctx, path, depth, entry.transform)`. `rasterizePathToStencil` takes `fillMesh(ctx, path)`, whose tolerance comes from `ctx.state.transform` (the child's 8× transform), and only uses `model` for placement, so the circle is flattened 8× finer. At `leaveClip` the state is back at the clip group's transform, so `popClip` flattens the same circle coarser. Both polygons are inscribed, so the coarse one sits inside the fine one, and the pop leaves the clip bit set in the sliver between them. The next sibling clip pushed at that depth tests only the ancestor bits and writes its bit where its own path covers, so the stale sliver still passes `clipTest(depth)` and content drawn there shows outside its clip. The same mismatch has `drawInto` (retained.ts) re-enter each enclosing clip under the retained group's transform rather than `clip.transform`, so an enclosing clip drawn at a much smaller scale than the group comes out visibly faceted. Expected: one tolerance per clip, taken from the transform the path is drawn in (`model`).
- evidence: read
- severity: low
- fix: packages/renderer/src/draw/clip.ts
- size: line
- cause: tolerance read from ctx.state.transform rather than model
- confidence: likely

## A retained group nested inside an effects buffer that is inside another retained group's tile reuses the scratch buffer that tile is still drawing into
- where: packages/renderer/src/draw/retained.ts:61 (drawRetainedGroup)
- scenario: retained group B is drawn single-sampled (it sits inside an effects buffer, or the canvas is not multisampled), so `drawInto` renders B's tile into the `samples`-keyed scratch target S. One of B's children C has effects: `drawGroupWithEffects` sets `ctx.renderTarget` to a fresh object that is not in `scratchTargets`. A retained descendant D of C then finds `inScratch` false, asks for a surface with the same `multisample === false`, and `RetainedSurfaces` hands it the same scratch target S (one scratch per sample count). D's `drawInto` begins a pass on S with `clear: { color: true, stencil: true }`, draws, and resolves. That wipes B's partly drawn tile and its clip bits. When control returns, B goes on drawing into S and resolves a tile missing everything it drew before C. Expected: the guard against drawing one retained surface inside another should hold through nested render targets, either as a depth flag or by marking the scratch target itself rather than the `renderTarget` wrapper.
- evidence: read (retained.ts guard; RetainedSurfaces.ts keeps one scratch per sample count, `scratches.set(samples, scratch)`)
- severity: medium
- fix: packages/renderer/src/draw/retained.ts, packages/renderer/src/draw/groupEffects.ts
- size: function
- cause: scratch-in-use guard keyed on renderTarget object identity
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
