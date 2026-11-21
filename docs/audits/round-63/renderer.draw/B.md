I couldn't write `.skulkr/out/findings.md`: permission to write it was denied twice. As the brief allows, the whole findings document is below. The commit the brief names (`1b4edb3a…`) isn't in this clone (`git cat-file` reports a bad object), so I read HEAD `6f634fabe1`, where `packages/renderer/src/draw` has no local changes.

```markdown
# Audit round 63 — renderer.draw (blind reviewer)

Read at HEAD 6f634fabe1: the brief's commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not in this clone.

## A far-off rect clip is written to the stencil away from where it is
- where: packages/renderer/src/draw/clip.ts:232 (rasterizePathToStencil, reached from pushClip / popClip / materializeClips)
- scenario: a group clip `{kind:'rect', x:20000, y:0, width:200, height:200}`. Any corner at or past `ORIGIN_THRESHOLD` (16384) is enough. `getMesh` → `tessellateRect` gives the rect mesh an `origin` (`originFor(corners)`) and stores its vertices relative to that origin. `rasterizePathToStencil` takes its origin from `path.kind === 'polygon' ? path.origin : undefined`, which is always undefined for a rect. So it draws the origin-relative vertices with no offset, and the clip bit lands about 20000 units from the clip. The clip goes to the stencil when:
  - it is not axis-aligned on a target with no hulls (an effects buffer, a retained tile, any `ctx.projection`, or `batchVariants` absent), or
  - it is axis-aligned and gets materialized by any draw that draws for itself inside it: a mesh past the batching vertex cap, a custom shader, a text layer, gradient- or pattern-filled text, or an even-odd stencil fill. On a hull-capable canvas this only happens when `snappedRectOf` returns null.
  Everything drawn under that clip then fails the clip test and disappears. It should place the mesh by `fillMesh(ctx, path).origin`, as `drawPathFill` does with `mesh.origin`.
- evidence: read (geom/src/tessellate/tessellate.ts `tessellateRect`; tessellate.test.ts:28 "measures a rect far from 0 from an origin"; geom/src/paths/pathOrigin.ts `originFor`, `ORIGIN_THRESHOLD = 16_384`)
- severity: medium

## A far-off rect's aligned stroke, drawn through the stencil, marks its fill in the wrong place
- where: packages/renderer/src/draw/pathPaint.ts:133 (drawPathStroke → drawPathStrokeStenciled, lines 248–262)
- scenario: a `rect` path past `ORIGIN_THRESHOLD`, e.g. x=20000 with width and height 20, stroked `align:'inner'` with width 30. `ribbonAligns` is false because the inner stroke overfills, and the stencil path runs when either:
  - `stroke.vertexColors` is set, so `cutAlignedRibbon` returns null, or
  - `batchVariants.cuts === false`.
  `atMeshOrigin` gets `cmd.path.kind === 'polygon' ? cmd.path.origin : undefined`, which is undefined for a rect. The fill handle (origin-relative, see `tessellateRect`) therefore writes its `ALIGNED_FILL` bit about 20000 units away. The doubled ribbon has absolute vertices (`ribbonMesh` gives an origin only to polygons), so its draw lands in the right place but tests the wrong mask. Result: an inner stroke paints nothing; an outer one paints the full doubled ribbon on both sides of the edge. The fill handle needs its own mesh's origin, separate from the ribbon's.
- evidence: read (stroke/src/tessellate/stroke.ts:182 `ribbonMesh`; geom `tessellateRect`)
- severity: medium

## Vertex colors with a non-solid paint: a fill drops the colors, a stroke drops the paint
- where: packages/renderer/src/draw/pathPaint.ts:60 (drawPathFill) vs pathPaint.ts:178 (drawRibbon) and vertexColors.ts:119 (vertexColorBase)
- scenario: a path with `fill.paint` a linear gradient and `vertexColors` set. `drawPathFill` only takes the vertex-color path when `isSolid && hasVColors`, so it reaches `tryStageFill(mesh, undefined)`, then `drawPathFillByKind`: the gradient draws and the vertex colors are silently ignored. The same gradient as `stroke.paint` with `stroke.vertexColors` goes through `tryStageVertexColors(…, vertexColorBase(paint))`, where the base is white at the paint's opacity: the vertex colors draw and the gradient is ignored. The same paint/vertex-color question gets opposite answers for fill and stroke.
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
```

<!-- done: 3 findings, files read: 35 -->