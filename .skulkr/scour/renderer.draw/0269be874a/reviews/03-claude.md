# Findings: renderer.draw

## A clip's stencil mesh is flattened at the live group's tolerance, not its own transform's, so a pop can miss bits its push set
- where: packages/renderer/src/draw/clip.ts:229 (rasterizePathToStencil), also :243 (pushClip's `fillMeshHandle(ctx, path)`)
- scenario: `rasterizePathToStencil(ctx, path, model, …)` places the mesh by `model` but builds it with `fillMesh(ctx, path)`, whose tolerance comes from `ctx.state.transform` (`flattenToleranceOf`). Push and pop of the same clip run under different live transforms in at least two real sequences: (a) a clipped group with effects: `draw.ts:45-53` pushes the group transform, calls `enterGroupClip`, pops it, and calls `leaveClip` later under the parent's transform. A group scaled 4× with a curved stencil-only clip (a crescent, a ring) is pushed from a mesh two octaves finer than the one popped. (b) A rect/hull/plane clip that `materializeClips` gives a bit during a child's own draw (`flushForOwnDraw`, `enterUncut`) is flattened at that child's transform, while `leaveClip` pops it under the clip owner's. Plane clips are curved convex paths (a circle inside an effects buffer, where `hullMap` is null). Where the two meshes differ, `clipPop` clears only where the coarser mesh covers. The bit stays set in the sliver between the meshes. A later sibling clip at the same depth then sets its own bit only where its path covers, so the sibling's content also draws in the leftover sliver, outside its clip. In `retained.ts` `drawInto` the outer clips are entered under the retained group's state rather than their own transforms, so they flatten at the wrong tolerance there too. Expected: flatten each clip at the tolerance its `model` implies (`worldFlattenTolerance(ctx.flattenTolerance, model)`), so push, pop and materialize all build the same mesh.
- evidence: read
- severity: medium
- fix: packages/renderer/src/draw/clip.ts, packages/renderer/src/draw/mesh.ts
- size: function
- cause: tolerance taken from live state instead of the clip's transform
- confidence: likely

## A throw while an effects group or a retained surface draws leaves the context in the offscreen buffer and leaks pooled targets
- where: packages/renderer/src/draw/groupEffects.ts:120 (drawGroupWithEffects); packages/renderer/src/draw/retained.ts:161 (drawInto)
- scenario: both functions swap out `ctx.clipDepth`, `ctx.clipStack`, `drawBatch.clip`, `ctx.projection`, `ctx.renderTarget` (and in `drawGroupWithEffects`, the pushed isolated group state). They put them back only after the children dispatch and `targets.acquire(...)`, with no `try/finally`. The children can throw: `enterGroupClip` throws by design past seven nested clips, and the clip budget restarts at 0 inside an effects buffer. When one does, the borrowed `EffectTargets` buffers are never released, and the GPU pass stays open on the offscreen target. The context also keeps the wrong render target, clip stack and group state. `draw.ts:66-72` pops state on the same throw, so a throw here is expected to leave the context clean. A scene that throws this way every frame leaks one or more pooled targets per frame. Expected: restore and release in `finally`.
- evidence: read
- severity: low
- fix: packages/renderer/src/draw/groupEffects.ts, packages/renderer/src/draw/retained.ts
- size: function
- cause: missing try/finally around swapped context state
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
