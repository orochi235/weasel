# renderer.part1 findings

Read against the working tree at 830b463cc1 (the brief's 608f35f5 is not in this clone; `git status` shows no
local changes under `packages/renderer/src`).

## Outline-glyph meshes bake the text's position into float32 vertices with no `origin`, so outlined text far from the origin jitters
- where: packages/renderer/src/glyphOutlineMesh.ts:109-127 (mergeGlyphMeshes)
- scenario: a `TextDrawCommand` at `x: 1_000_000` under a world transform, zoomed in until its glyphs pass
  `textOutlineMinScreenSize` and draw from outlines. `mergeGlyphMeshes` writes `x + dx + …` straight into a
  `Float32Array`, where at 1e6 the grid is 1/16 unit; at 100× zoom every outline vertex snaps to a ~6 px grid and the
  glyphs distort and shimmer as the view moves. `Mesh.origin` exists for exactly this (`pushGradientMesh` adds it back
  in doubles, `geom/tessellate/mesh.ts:24`), but the merged mesh never sets one; it should measure vertices from
  `(dx + first glyph x, dy + first glyph baseline)` and carry that as `origin`. Atlas glyphs don't have the problem:
  they are mapped in doubles before staging.
- evidence: read
- severity: medium

## `meshGradientXml` joins corner colors with spaces, so a mesh with any functional-notation color does not survive an SVG round trip
- where: packages/renderer/src/meshPaint/meshPaint.ts:311 (meshGradientXml)
- scenario: a patch with corner colors `['rgb(255, 0, 0)', '#0f0', '#00f', '#fff']` (or `oklch(0.7 0.1 30)`, `hsl(…)`;
  `parseColor` accepts all of these, and they are what a color picker emitting CSS writes). The export writes
  `colors="rgb(255, 0, 0) #0f0 #00f #fff"`; `readMeshGradient` (`packages/svg/src/readGradients.ts:243`) splits that
  attribute on whitespace, gets 6 tokens instead of 4, and drops the patch with a warning, so the reimported paint loses
  it (or becomes `null` when every patch does). The writer needs a separator that cannot occur inside a color
  (e.g. `;`), or to normalize each color to hex first, matched by the reader.
- evidence: read
- severity: medium

## The mesh bake hands straight-alpha texels to a texture the paint-kind contract says is premultiplied, so bilinear sampling darkens every mesh edge
- where: packages/renderer/src/meshPaint/bake.ts:159 (fillTriangle), packages/renderer/src/meshPaint/meshShader.ts:48-50
- scenario: `PaintBindContext.createTexture` is documented as "premultiplied RGBA8 texels … bilinear and clamped"
  (`paintKinds.ts:96`), but `bakeMesh` writes straight RGBA and leaves texels outside every patch at `(0,0,0,0)`; the
  fragment shader samples bilinearly and only then multiplies rgb by alpha. At any patch edge that is not the bake box's
  edge (the bowed edges of `seedMeshPatch`, any curved or non-rectangular mesh, a gap between patches) a sample halfway
  between an opaque red texel and an empty one reads straight `(0.5, 0, 0, 0.5)` and is output as premultiplied
  `(0.25, 0, 0, 0.5)`, i.e. half-dark red at half coverage instead of full red at half coverage: a dark fringe
  around the mesh, wider as the bake is magnified. Baking premultiplied (and dropping the shader's multiply by
  `texel.a`, keeping only opacity × alpha) matches the contract and removes it.
- evidence: read
- severity: low

## `blendFactorsOf` looks a composite name up on a plain object, so an unknown name throws a bare TypeError and `'constructor'` resolves to a function
- where: packages/renderer/src/effects/compositeOp.ts:45 (blendFactorsOf), :51 (isOwnComposite)
- scenario: `CompositeOp` mirrors canvas 2D's `globalCompositeOperation` names, so a layer or group config written in JS or
  read from JSON with `composite: 'multiply'` reaches `OPERATORS['multiply']` → `undefined`, and `isOwnComposite`'s
  destructure throws `Cannot destructure property 'source' of undefined` out of `cullDrawCommands` / `drawGroup`, killing
  the frame with no hint which group or name was at fault. `'toString'`/`'constructor'` instead hit
  `Object.prototype` and return a function, read as factors `undefined`. The table wants a null-prototype object or
  an `Object.hasOwn` check, with a named error for an unknown operator.
- evidence: read
- severity: low

## `meshFromStops` leaves the span before the first stop and after the last uncovered, so a gradient whose stops don't sit at 0 and 1 loses its ends on conversion
- where: packages/renderer/src/meshPaint/meshPaint.ts:134-145 (meshFromStops), :152-171 (meshStops)
- scenario: stops `[{offset: 0.2, color: red}, {offset: 0.8, color: blue}]`. A linear gradient pads: solid red over
  `[0, 0.2]`, solid blue over `[0.8, 1]`. `meshFromStops` makes one band over `[0.2, 0.8]` only, and the mesh shader
  draws everything outside the bake box transparent (`meshShader.ts:42`), so 40% of the shape goes blank, contrary to
  the doc's "a horizontal gradient survives the switch unchanged". Stops all at one offset (`[{0.5, red}, {0.5, blue}]`,
  a hard split) give no band at all and an empty, invisible mesh. Converting back, `meshStops` normalizes by the
  patches' own x span, so the `[0.2, 0.8]` band returns as stops at 0 and 1: the round trip also moves the stops.
  Adding pad bands from 0 to the first offset and from the last offset to 1 (in the end colors) fixes both directions.
- evidence: read
- severity: medium

## `renderIdsAsync` throws synchronously instead of rejecting when the id frame fails
- where: packages/renderer/src/WeaselRenderer.ts:255-257 (renderIdsAsync)
- scenario: `Promise.resolve(this.idFrame(…, false))` evaluates `idFrame` before any promise exists, so anything the
  frame throws (a clip nested past 7 levels, a `ShaderCompileError` from a custom shader, a paint kind's bind throwing)
  escapes as a synchronous exception. A picking caller written `renderer.renderIdsAsync(cmds).then(…).catch(report)` —
  the natural shape for an async API — never reaches its `catch`, and the throw lands in whatever pointer handler
  called it. Wrapping the call (`new Promise((resolve) => resolve(this.idFrame(…)))`, or an `async` method) turns it
  into the rejection the signature promises.
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

<!-- done: 6 findings, files read: 37 -->
