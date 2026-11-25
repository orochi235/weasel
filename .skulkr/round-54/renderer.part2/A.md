# Findings: renderer.part2 (round 54)

## A fractional tile `size` rasterizes a truncated tile whose shapes were laid out for the unrounded size, so the GL pattern has seams and drifts from the SVG export
- where: packages/renderer/src/patterns/rasterizeTile.ts:6-10 (rasterizeTile), packages/renderer/src/patterns/resolveSpec.ts:73-77 (build)
- scenario: a tile paint `{ kind: 'hatch', color: '#000', size: 5.5 }` (sizes are plain `number`s in `TilePatternSpec`, so JSON or a slider can produce one). `rasterizeTile` only rejects `size < 1`; `new OffscreenCanvas(5.5, 5.5)` truncates to a 5×5 canvas, while `tileGeometry` places the diagonals and their corner stubs for a 5.5 tile. The bitmap is 5 px, and a texture paint with no extent repeats at the source's pixel size, so the GL pattern repeats every 5 units with diagonals that do not meet at the seam. `@weasel-js/svg` (`patterns.ts`) and `paint-kinds/tileSvg.ts` take `tileGeometry(spec).size` = 5.5 for the `<pattern>` — the raster/vector drift `tileGeometry`'s header says sharing the geometry prevents. It should round the size once (in `tileSize`) or size the canvas with `Math.ceil` and scale.
- evidence: read
- severity: low

## `patchBounds` samples an 8×8 grid, so it under-bounds a bowed patch edge and the mesh bake crops the bulge
- where: packages/renderer/src/meshPaint/surface.ts:155-172 (patchBounds)
- scenario: a Coons patch whose bottom edge has control-point y values `0, -1000, 0, 0` (corner 0 → corner 1). That edge is `y(t) = -3000·(1-t)²·t`, extremal at t = 1/3 with y = -444.4; the samples at t = 0.25 and 0.375 give -421.9 and -439.5, so `patchBounds` reports minY ≈ -439.5. `bakeMesh` (meshPaint/bake.ts) sizes its bitmap from `meshBounds` → `patchBounds`, then rasterizes on a grid of at least 24 per side, which does evaluate t = 8/24 = 1/3; that vertex maps to a negative texel row and the strip between -444.4 and -439.5 (about 1% of the patch's height) is cut off the baked texture. A bound has to enclose the surface; the sampled grid does not, and the bake's finer grid then lands outside it.
- evidence: read (worked by hand from the code; not run)
- severity: low

## `textCommand` / `textCommandFromRuns(Into)` pass a tile or image pattern through unresolved, so that text draws nothing, while `textCommandFromPose` resolves it
- where: packages/renderer/src/textCommand.ts:34-61 (textCommandFromRuns), :69-95 (textCommandFromRunsInto), compared with :145-152 (runsInPoseFrame)
- scenario: `textCommand(0, 0, 'Hi', style, undefined, undefined, undefined, { fill: { paint: { kind: 'hatch', color: '#000' } } })`, or a `StyledRun` whose `fill.paint` is `{ kind: 'image', src }`. Both type-check (`TextPaint.fill` and `ResolvedRun.fill` are a full `Fill`, and `TextDrawCommand.runs` is `ResolvedRun[]`, not `CommandFill`). `textCommandFromPose` swaps such a paint for its `texture` paint through `commandFill` → `resolvePaintPattern`, a step its own doc says is there because "the renderer can do neither". The other three builders skip it, so the command reaches the renderer with `kind: 'hatch'`; `glyphPaintKindOf` (draw/text.ts:244) sends it down the registered-kind path, `paint-kinds` registers `hatch` with no `bind`, so `bindPaintKind` returns null and the glyphs paint nothing, silently (the kind is known, so not even the unregistered-kind warning fires). Placing a tile needs no box, so these builders could run `resolvePaintPattern` on each run's fill and stroke paint as the pose path does.
- evidence: read
- severity: medium

## A text layer's cached box never sees a font land, so after a face registers or loads the layer is culled and bounded by its fallback-metric layout
- where: packages/renderer/src/textBounds.ts:52 (layerBoxOf), :59-64 (textLayerBox)
- scenario: a `{ kind: 'text-layer', texts }` drawn on the first frame before its face has loaded. `layerBoxOf = createPart(texts => unionOf(texts, IDENTITY))` keeps the box made from that frame's layout for as long as `texts` lives. When the face lands, `faceGeneration()` moves, `cachedLayoutRuns` drops its layouts (text/layout/layoutCache.ts:201-206) and the glyphs re-lay out at the real advances; the layer's own draw rebuilds on `textEngineGeneration` too (draw/textLayer.ts:69-93). The box does not. The layer's commands are immutable by contract, so nothing hands over a new `texts` array. A face wider than the fallback by 10% on a 100-glyph line puts the line end about 10 em past the old box, beyond the half-em `TEXT_INK_EM.side` margin, so `cullDrawCommands` (`case 'text-layer'`) drops the layer while that strip is still on screen, and `contentBox` (retain/contentBounds.ts) gives a retained group holding it a surface that clips the line. Registering a shaper or bidi engine (`textEngineGeneration`) moves glyphs the same way. The memo needs the generations in its key, or must be dropped when they move.
- evidence: read
- severity: medium

## `registerPaintDrawKind` that throws on a sourceless program leaves the programs registered before it in place, unreleasable, over whatever those ids held
- where: packages/renderer/src/paintKinds.ts:154-165 (holdPrograms), :186 (registerPaintDrawKind)
- scenario: kind B declares `programs: { 'shared-prog': { glsl: {...} }, broken: {} }`, where `'shared-prog'` is also the id of a program kind A (live) declared. `holdPrograms` registers `'shared-prog'` with `replace: true`, then reaches `broken`, which has no source, and throws. The throw comes before `PROGRAMS_HELD.set(entry, releases)` and before `KINDS.push`, so `registerPaintDrawKind` returns no disposer, and nothing records the release for B's `'shared-prog'`. Kind A stays the live draw kind, but its `bind` now names B's shader, permanently; with no clash, B's program is simply leaked into the registry. The source check should run over every declared program before any is registered.
- evidence: read
- severity: low

## A `'bounds'` linear gradient on a non-square box draws its color bands perpendicular in the node's frame, while the SVG export (and SVG import) means `objectBoundingBox`, where they lean with the box
- where: packages/renderer/src/paintToLocalUnits.ts:38-40 (paintToLocalUnits, linear branch); exported as `objectBoundingBox` at packages/svg/src/gradients.ts:54
- scenario: `{ kind: 'linear-gradient', from: {x:0,y:0}, to: {x:1,y:1}, units: 'bounds' }` on a 200×100 rect. `paintToLocalUnits` maps the two endpoints to (0,0) and (200,100), and the renderer then draws bands perpendicular to that vector in local space: corner (200,0) gets t = 40000/50000 = 0.8 and corner (0,100) gets t = 0.2. SVG's `objectBoundingBox` scales the whole gradient space with the box, so its bands run parallel to the box's other diagonal, and both of those corners get t = 0.5. The canvas and the exported `.svg` of the same node show different gradients, and an imported SVG with a diagonal `objectBoundingBox` gradient on a non-square shape renders differently than in a browser. Unlike the radial case, whose circular-only limit the function's doc states, this one has an exact fix: an affine image of a linear gradient is still a linear gradient, so `to` can be chosen to make the mapped bands' normal the gradient direction. Only the endpoints are mapped now.
- evidence: read (values worked by hand)
- severity: medium

## `retainBudget`'s documented overshoot (36 MiB at 4x) leaves out the second, single-sampled scratch buffer `RetainedSurfaces` keeps beside the multisampled one
- where: packages/renderer/src/rendererTypes.ts:123-133 (WeaselRendererOptions.retainBudget); packages/renderer/src/retain/RetainedSurfaces.ts:97, :346-355 (scratches, scratchFor)
- scenario: a frame that redraws one retained group composited into the canvas (multisampled scratch) and one composited into a group's effects buffer (`multisample: false`). `scratches` holds one target per sample count, each `createTarget({ ..., stencil: true })` at up to 1024×1024, and `endFrame` drops each only when it is unused or oversized, so both stay across frames. The single-sampled one is about 8 MiB more (color and stencil), so the frame peaks near budget + 44 MiB at 4x, not the "budget plus that buffer, 36 MiB more" the option promises; the class's own header does mention the second buffer. Someone sizing `retainBudget` from the option's doc undercounts.
- evidence: read
- severity: low

## `keepKey` keeps a retained group's effect uniforms by reference, so an effect whose uniform array is rewritten in place keeps compositing stale pixels
- where: packages/renderer/src/retain/retainedKey.ts:33-43 (keepKey), :101-112 (sameUniforms / sameUniform)
- scenario: a retained group with `effects: [{ program, reach: 4, uniforms: { u_tint: tint } }]`, where `tint` is a `Float32Array` the caller updates each frame (`tint[0] = t`) and passes again, as it does for its transform. `keepKey` copies `transform`, `colorMatrix`, `viewMatrix`, `screenMatrix`, each clip's transform and `window`, so "no later write to the caller's matrices reaches" the kept key, but it spreads `effects` as is. The kept key and the new one then hold the same `Float32Array`; `sameFloats` compares it with itself, `sameKey` is true, and `RetainedSurfaces.lookup` returns `kept` with the pixels drawn under the first frame's tint for every later frame. Copying each array uniform in `keepKey`, as the matrices are copied, makes the comparison see the write.
- evidence: read
- severity: low

## Files read
packages/renderer/src/meshPaint/surface.ts
packages/renderer/src/paintKinds.ts
packages/renderer/src/paintResources.ts
packages/renderer/src/paintScratch.ts
packages/renderer/src/paintToLocalUnits.ts
packages/renderer/src/paintedBounds.ts
packages/renderer/src/patterns-builtin.ts
packages/renderer/src/patterns/commandPaint.ts
packages/renderer/src/patterns/imagePatternId.ts
packages/renderer/src/patterns/index.ts
packages/renderer/src/patterns/patterns-builtin.ts
packages/renderer/src/patterns/rasterizeTile.ts
packages/renderer/src/patterns/resolveImage.ts
packages/renderer/src/patterns/resolveSpec.ts
packages/renderer/src/patterns/test-utils/fakeOffscreenCanvas.ts
packages/renderer/src/patterns/tileGeometry.ts
packages/renderer/src/pbt.fixture.ts
packages/renderer/src/readPixels.ts
packages/renderer/src/rendererParts.ts
packages/renderer/src/rendererTypes.ts
packages/renderer/src/retain/RetainedSurfaces.ts
packages/renderer/src/retain/contentBounds.ts
packages/renderer/src/retain/movesWithView.ts
packages/renderer/src/retain/retainedKey.ts
packages/renderer/src/retain/tileCull.ts
packages/renderer/src/spriteSheet.ts
packages/renderer/src/state/GroupState.ts
packages/renderer/src/state/colorMatrix.ts
packages/renderer/src/strokeLengths.ts
packages/renderer/src/targetRect.ts
packages/renderer/src/test-seams.ts
packages/renderer/src/textBounds.ts
packages/renderer/src/textCommand.ts
packages/renderer/src/textLayout.ts
packages/renderer/src/textures/registerTexture.ts
packages/renderer/src/warnOnce.ts

<!-- done: 8 findings, files read: 36 -->
