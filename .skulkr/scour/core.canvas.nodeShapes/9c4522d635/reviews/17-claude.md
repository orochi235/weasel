# Findings: core.canvas.nodeShapes

## `kit:shape` draws `data.sides` / `data.points` raw, while the shape generator rounds and clamps the same counts
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:107 (pathForShape)
- scenario: a JSON scene node `{ shape: 'polygon', sides: 5.5 }` paints a 6-vertex outline whose last edge is short (angles `i / 5.5 · 2π`), not a regular polygon; `sides: 0`, a negative count or `NaN` paints an empty closed path; `sides: 1e8` allocates 1e8 vertices on every paint, silhouette and drawn-bounds call; `sides: Infinity` never leaves `regularPolygonPath`'s loop (packages/geom/src/paths/builder.ts:261), hanging the frame. Same for `points` through `starPath`. `shapeGeneratorPath` answers the same question with `count()` = round and clamp to `SHAPE_COUNT_RANGE` (3..32) (packages/core/src/domains/paths/shapeGenerator.ts:74), so the two pathways draw different shapes for one count.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/domains/paths/shapeGenerator.ts (export the count clamp and use it in pathForShape)
- size: line
- cause: unvalidated count, duplicate decision
- confidence: sure

## `hasStroke` counts an infinite width as ink where `inkReach` and the renderer say it draws nothing
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:132 (hasStroke)
- scenario: a stroke `{ paint, width: Infinity }`: `inkReach` uses `widthHasInk` (`width > 0 && Number.isFinite(width)`, packages/stroke/src/tessellate/stroke.ts:191) and reports no reach, so the stroke is unpickable and undrawn, but `hasStroke` tests only `> 0` and reports true, so an action turning ink into geometry tries to outline an infinite-width stroke. Two answers to "does this width draw ink".
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts (use widthHasInk)
- size: line
- cause: duplicate decision
- confidence: sure

## `strokedBounds` tessellates an infinite width instead of returning null
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:26 (strokedBounds)
- scenario: a stroke whose resolved width is `Infinity` passes `!(width > 0)` and is tessellated at infinite width; the box comes back with infinite or NaN extents (Infinity − Infinity), so `drawnBounds` of a node the renderer draws no line for (`widthHasInk` false) is infinite/NaN, poisoning a union of drawn bounds (fit-to-content, export box). Should be `!widthHasInk(width)` → no ribbon, as `inkReach` decides.
- evidence: read
- severity: low
- size: line
- cause: guard differs from widthHasInk
- confidence: likely

## Files read
packages/core/src/canvas/nodeShapes/derivedPainter.ts
packages/core/src/canvas/nodeShapes/groupBoxPainter.ts
packages/core/src/canvas/nodeShapes/imagePainter.ts
packages/core/src/canvas/nodeShapes/memo.ts
packages/core/src/canvas/nodeShapes/nodePaint.ts
packages/core/src/canvas/nodeShapes/pathPainter.ts
packages/core/src/canvas/nodeShapes/pathPosePainter.ts
packages/core/src/canvas/nodeShapes/pickOutline.ts
packages/core/src/canvas/nodeShapes/poseBox.ts
packages/core/src/canvas/nodeShapes/rectFallbackPainter.ts
packages/core/src/canvas/nodeShapes/shapePainter.ts
packages/core/src/canvas/nodeShapes/strokedBounds.ts

<!-- done: 3 findings, files read: 12 -->
