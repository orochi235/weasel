# Audit round 71 — renderer.part1 findings

## Composite pass leaves the color matrix's alpha unclamped, where every other fill shader clamps it
- where: packages/renderer/src/effects/effectPrelude.ts:62 (COMPOSITE_FRAG_SRC)
- scenario: an isolated or effects group with `colorMatrix` whose alpha row/bias pushes alpha past 1 (e.g. bias a = +0.5 on a pixel of alpha 0.8 → 1.3) or below 0. The composite computes `c.a *= u_alpha` and writes `vec4(clamp(c.rgb) * c.a, c.a)`: premultiplied rgb is scaled by 1.3 before the framebuffer clamps each channel separately, so hue shifts (channels saturate unevenly) and source-over then blends with a source alpha > 1 (negative destination factor before clamp). The same matrix on a non-isolated group goes through `batchFill`/`pathFill`/`gradFill`/`patternFill`, all of which `clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0)` all four channels — so one group draws differently depending on whether it is isolated. Should clamp `c` (alpha included) before premultiplying.
- evidence: read (compared against shaders/batchFill.ts:312, pathFill.ts:32/63, gradFill.ts:66, patternFill.ts:45)
- severity: medium

## `cullDrawCommands` copies a `retain` group whose children it partly drops, so the retained surface is redrawn on every call
- where: packages/renderer/src/cullDrawCommands.ts:63-66 (cullOne, 'group')
- scenario: a consumer culls a command list holding `{ kind: 'group', retain: 'big', children }` (hundreds of commands, some off screen) each frame with the exported `cullDrawCommands`, then renders it. Whenever any child is outside the rect, `cullList` returns a fresh `slice` and `cullOne` returns `{ ...cmd, children }`, so the group reaching the renderer has a different `children` array every frame. `GroupDrawCommand.retain` redraws whenever `children` is a different array, so the surface never composites — the group pays the retained surface's cost plus a full redraw every frame. It also defeats retain's pan path, which wants the off-screen children (its margin) drawn into the surface. A `retain` group should be kept or dropped whole, as an effects group is.
- evidence: read (cullDrawCommands.ts; the redraw-on-new-array rule is DrawCommand.ts:99-105); that the surface is then redrawn each frame is inferred from that rule, not run
- severity: low

## bake.ts's header still says the bake is straight RGBA and the shader premultiplies; it is premultiplied and neither shader premultiplies
- where: packages/renderer/src/meshPaint/bake.ts:6-7 (module doc), and gpu/webgpu/wgsl/meshPaint.ts's "straight-RGBA bake" doc
- scenario: `bakeMesh` is public (`@weasel-js/renderer/mesh`). A consumer reading the module doc uploads its `pixels` as straight alpha into its own premultiplying shader, and gets a double-premultiplied, too-dark translucent mesh. The code writes `rgb * alpha` (bake.ts:167) and `BakedMesh.pixels` says premultiplied (bake.ts:35); `MESH_FRAG_SRC` and `MESH_WGSL` only scale by opacity. Commit f88fa83032 switched the bake to premultiplied and left both docs behind.
- evidence: read
- severity: low

## Overlapping mesh patches overwrite each other's texels instead of compositing, so a translucent patch punches a hole in the one beneath
- where: packages/renderer/src/meshPaint/bake.ts:164-169 (fillTriangle)
- scenario: two patches overlap, the later one with corner colors at alpha 0.3 (or a patch that folds over itself). `fillTriangle` assigns each covered texel outright, so in the overlap the result is the later patch's 30% color with the earlier opaque patch gone, where painting patch after patch in painter's order, as PDF orders patches, shows the later patch composited over the earlier one. Opaque meshes are unaffected.
- evidence: read; what other renderers show is inference
- severity: low

## A renderer whose context is lost and never restored keeps pinning the images it last drew
- where: packages/renderer/src/WeaselRenderer.ts:118 and packages/renderer/src/contextLoss.ts:9-12 (onLost)
- scenario: a WebGL context is lost and never comes back (the browser gave up on it), and the app neither disposes the renderer nor draws through it again (`render` returns early while lost). The loss handler only sets `lost`; the renderer's `GLImageCache` stays in the global `live` set with the last frame's draws marked, so `imageSourceInLatestFrame` answers true for those bitmaps forever and `enforceBudget` never drops them. Its `MAX_TEXTURE_SIZE` also keeps shaping `maxImageTextureSide`. Abandoning the image cache on loss (as `restore` does with `abandon()`) would release both.
- evidence: read (GLImageCache.ts `live`, `imageSourceInLatestFrame`, `abandon`); the never-restored loss is a sequence a real browser produces, not run
- severity: low

## Files read
packages/renderer/src/DrawCommand.ts
packages/renderer/src/WeaselRenderer.ts
packages/renderer/src/batchBuffers.ts
packages/renderer/src/batchClip.ts
packages/renderer/src/batchHull.ts
packages/renderer/src/batchStage.ts
packages/renderer/src/contextLoss.ts
packages/renderer/src/contextResources.ts
packages/renderer/src/cullDrawCommands.ts
packages/renderer/src/cullTree.fixture.ts
packages/renderer/src/draw.ts
packages/renderer/src/drawBatch.ts
packages/renderer/src/drawStream.ts
packages/renderer/src/dropShadow.ts
packages/renderer/src/effects/EffectTargets.ts
packages/renderer/src/effects/builtins.ts
packages/renderer/src/effects/composite.ts
packages/renderer/src/effects/compositeOp.ts
packages/renderer/src/effects/effectPrelude.ts
packages/renderer/src/effects/types.ts
packages/renderer/src/glyphCorners.ts
packages/renderer/src/glyphOutlineMesh.ts
packages/renderer/src/images/bitmapHolds.ts
packages/renderer/src/images/bitmapNames.ts
packages/renderer/src/images/imageCache.ts
packages/renderer/src/images/imageLoader.ts
packages/renderer/src/images/imageReads.ts
packages/renderer/src/index.ts
packages/renderer/src/markerCommands.ts
packages/renderer/src/math/patternSpace.ts
packages/renderer/src/mesh.ts
packages/renderer/src/meshPaint/bake.ts
packages/renderer/src/meshPaint/bakeCache.ts
packages/renderer/src/meshPaint/handles.ts
packages/renderer/src/meshPaint/index.ts
packages/renderer/src/meshPaint/meshPaint.ts
packages/renderer/src/meshPaint/meshShader.ts
packages/renderer/src/meshPaint/surface.ts

<!-- done: 5 findings, files read: 38 -->

