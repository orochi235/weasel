# Audit round 71 — renderer.part1 — blind reviewer findings

## Effect composite leaves color-matrix alpha unclamped, unlike every other color-matrix shader
- where: packages/renderer/src/effects/effectPrelude.ts:62-64 (COMPOSITE_FRAG_SRC)
- scenario: a group with `isolate: true` (or `effects`, or a non-default `composite`) and a `colorMatrix` that raises alpha, e.g. alpha row scaled by 2 with no bias, over a texel of straight rgb 0.5 at alpha 0.8. The composite computes `c.a = 1.6` and writes `clamp(rgb) * c.a = 0.8` for rgb with alpha 1.6, which the UNORM target clamps to alpha 1 and rgb 0.8. The same group drawn without isolation goes through `pathFill`/`gradFill`/`patternFill`/`batchFill`, which all do `clamp(M * src + bias, 0, 1)` on all four channels before premultiplying, and get rgb 0.5 at alpha 1. A negative alpha bias likewise gives a negative `c.a`, turning rgb negative where the other shaders clamp alpha to 0 first. So one color matrix gives two different colors depending on whether its group is isolated: the same decision answered two ways.
- evidence: read (effectPrelude.ts:62-64 against shaders/pathFill.ts:32,63, gradFill.ts:66, patternFill.ts:45, batchFill.ts:312)
- severity: medium

## `bake.ts` header says the bake is straight alpha and the shader premultiplies; both are premultiplied
- where: packages/renderer/src/meshPaint/bake.ts:7-8 (module doc)
- scenario: the module doc says "The bitmap is straight (non-premultiplied) RGBA; the fragment shader premultiplies." `fillTriangle` writes `color * alpha * 255` (premultiplied, bake.ts:167), `BakedMesh.pixels` says premultiplied (bake.ts:35), and `MESH_FRAG_SRC` only scales the texel by opacity (meshShader.ts:49). A consumer reading the header and calling the exported `bakeMesh` to upload its own texture would premultiply a second time and darken every translucent mesh.
- evidence: read
- severity: low

## `Effect.uniforms` and `registerEffect` docs leave out `u_windowOrigin`, a uniform the renderer sets
- where: packages/renderer/src/effects/types.ts:12-13 (Effect doc), types.ts:58-59 (registerEffect doc)
- scenario: the docs list `u_source`, `u_resolution` and `u_texel` as the renderer's own, never to be passed. `EFFECT_KIT_UNIFORMS` (effectPrelude.ts:41) and the prelude contract (effectPrelude.ts:14-17) also give `u_windowOrigin`. An effect author following types.ts can pass `u_windowOrigin` in `uniforms` with a meaning of their own. Either the kit's value overwrites it or theirs overwrites the kit's; the docs promise neither.
- evidence: read
- severity: low

## With both `gl` and `canvas` given, the renderer sizes and watches `canvas`, though `gl` "wins"
- where: packages/renderer/src/WeaselRenderer.ts:105-106, 118 (constructor)
- scenario: `WeaselRendererOptions` says `gl` wins over `canvas`, and `openWebGL` draws with `opts.gl` and returns `gl.canvas` as the loss target. The constructor then sets `this.canvas = opts.canvas` and sizes it, and `resize` keeps sizing it. It also passes `this.canvas ?? lossTarget` to `watchContextLoss`, so the loss listener goes on `opts.canvas` and not on the context's own canvas. A caller that passes a `gl` from canvas A and a `canvas` B gets B's drawing buffer resized while A is drawn to. A context loss on A is never heard, so `isContextLost()` stays false and frames draw into a dead context with no restore.
- evidence: read (WeaselRenderer.ts, gpu/webgl/openWebGL.ts:13-15, rendererTypes.ts:99-104)
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

<!-- done: 4 findings, files read: 38 -->
