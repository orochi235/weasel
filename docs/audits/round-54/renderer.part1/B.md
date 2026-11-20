# Audit round 54 — renderer.part1 findings

## meshGradientXml writes patch colors space-joined, so any CSS color containing a space does not round-trip
- where: packages/renderer/src/meshPaint/meshPaint.ts:311 (meshGradientXml)
- scenario: a mesh patch whose colors are `rgb(255, 0, 0)`, `hsl(0 100% 50%)` or `oklch(0.7 0.1 30)` (all accepted by `parseColor`, which `bakeMesh` draws them with) is written as `colors="rgb(255, 0, 0) …"`. `@weasel-js/svg`'s reader (`readGradients.ts:244`) splits `colors` on whitespace, gets more than 4 tokens, and drops the patch with a warning; a mesh made only of such patches imports as no paint at all. Should write each color in a whitespace-free form (e.g. normalized hex) or use a separator the reader splits on.
- evidence: read
- severity: medium

## A mesh patch color that does not parse throws out of the render
- where: packages/renderer/src/meshPaint/bake.ts:98 (bakeMesh), reached from meshPaint.ts:228 (ensureBake via bindMesh)
- scenario: `bakeMesh` calls `parseColor` (which throws on anything it cannot read) on every patch color, and `isValidPatch` checks only the point count, not the colors (nor that there are four of them: a patch with 3 colors reads `corners[3]` as undefined inside `lerpColorArray`). A document holding a mesh paint with a bad color — e.g. imported from a `wzl:patch colors="red red red bogus"`, which `readMeshGradient` accepts since it checks only the count — throws inside `bindMesh` on every frame that draws the node, so the frame aborts rather than the patch being skipped or drawn flat.
- evidence: read
- severity: medium

## meshFromStops drops the pad regions outside the first and last stop, and a single stop at offset 1 yields an empty mesh
- where: packages/renderer/src/meshPaint/meshPaint.ts:134 (meshFromStops)
- scenario: stops `[{0.2, red}, {0.8, blue}]` give one band over x ∈ [0.2, 0.8]; the linear gradient this is converting pads red over [0, 0.2] and blue over [0.8, 1], but the mesh's box is the band alone and the mesh shader paints transparent outside it (`meshShader.ts:42`), so 40% of the shape goes empty — contrary to the doc's "a horizontal gradient survives the switch unchanged". A single stop at offset 1 is padded with another stop at offset 1, a zero-width gap, so `patches` is empty and the fill disappears; two stops at the same offset (a pure hard break) likewise give no patches. `meshStops` then normalizes by the band span, so the round trip moves the stops to 0 and 1 too.
- evidence: read
- severity: medium

## Mesh bake is straight alpha but sampled bilinear, so every patch edge inside the bake box gets a dark fringe
- where: packages/renderer/src/meshPaint/bake.ts:86 (bakeMesh) with meshShader.ts:48 (MESH_FRAG_SRC); texture made through meshPaint.ts:231 with `PAINT_TEXTURE_SAMPLING` (linear, `draw/paintBind.ts:26`)
- scenario: texels the patches do not cover stay (0,0,0,0) in a *straight*-alpha bitmap. A fragment halfway between a covered texel (r,g,b,1) and an uncovered one samples (r/2,g/2,b/2,0.5); the shader then multiplies rgb by a again, giving (r/4,g/4,b/4,0.5) premultiplied where (r/2,g/2,b/2,0.5) is right. Any mesh whose patches do not fill their bounding box — `seedMeshPatch`'s bowed square (the box's corners lie outside the patch), a non-rectangular or multi-patch mesh with gaps — draws a darkened rim along those edges, most visible for light colors and when the bake is magnified. Should bake premultiplied (and skip the shader's re-multiply) or bleed edge colors into uncovered texels.
- evidence: read
- severity: low

## A vector image's first raster is made at its declared size with no cap
- where: packages/renderer/src/images/imageLoader.ts:66 (rasterizeVector) via imageCache.ts:160 (startLoad, which calls `loader(src)` with no size)
- scenario: re-rasters are capped by `maxImageTextureSide()` and `MAX_VECTOR_RASTER_PIXELS` (`imageCache.ts:191`), but the first load takes `img.naturalWidth/naturalHeight`, which for an SVG is whatever its `width`/`height` attributes say. An SVG declaring `width="40000" height="40000"` makes a 6.4 GB canvas request: `createImageBitmap` fails (entry goes `'error'` for the page's life, so a valid picture never shows) or the tab runs out of memory; one at 8192×8192 succeeds as a 256 MB bitmap that already exceeds the default budget and many GPUs' max texture side. The first raster should be held to the same caps (natural size kept as the declared one for `scale`).
- evidence: read
- severity: medium

## A blurred drop shadow's interior is ~70% of its color where an unblurred one is 100%
- where: packages/renderer/src/dropShadow.ts:51 (dropShadowLayers)
- scenario: with `blur > 0` the shadow is 7 nested shapes each at alpha 0.16 (applied per child, since the group is not isolated), so the fully covered interior reaches 1 − 0.84⁷ ≈ 0.705 of `color`'s opacity; with `blur: 0` it is one shape at alpha 1. A box-shadow with `rgba(0,0,0,0.3)` thus drops from 0.30 to 0.21 in its interior as blur goes from 0 to 0.01 — a discontinuity, and unlike CSS, where the interior of a blurred shadow (away from its edges) is the full color.
- evidence: read
- severity: low

## Composite operator names are looked up on a plain object, so an unknown or inherited name throws or reads Object.prototype
- where: packages/renderer/src/effects/compositeOp.ts:40 (blendFactorsOf), used by isOwnComposite at :45
- scenario: `OPERATORS` is an object literal. A `composite` that arrives untyped at runtime (a layer config read from settings or JSON) of `'multiply'` makes `blendFactorsOf` return undefined and `isOwnComposite` throw `Cannot destructure property 'source' of undefined` from both `cullDrawCommands` and `drawGroup`, aborting the frame; `'constructor'` or `'toString'` returns a function, whose `source`/`destination` are undefined, so `isOwnComposite` says true and the group isolates with undefined blend factors. Should look up with an own-property check (or a `Map`) and treat an unknown name as `source-over` or reject it with a clear error.
- evidence: read
- severity: low

## imageStatus counts as an image read for a minted bitmap name but not for any other src
- where: packages/renderer/src/images/imageCache.ts:323 (imageStatus)
- scenario: for a `bitmapSrc` name, `imageStatus` answers through `getImageBitmap`, which calls `noteImageRead`; for every other src it reads `cache` directly. Code that asks `imageStatus` inside `imageReadsDuring` (to decide whether to draw a placeholder) reports minted bitmaps among the pictures it "asked for" and URL images not, so the two kinds of src are tracked differently by the same call. Should read `namedBitmap(src)` directly.
- evidence: read
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

<!-- done: 8 findings, files read: 37 -->
