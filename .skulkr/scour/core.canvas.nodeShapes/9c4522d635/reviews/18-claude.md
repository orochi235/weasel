# Findings: core.canvas.nodeShapes

## kit:shape builds polygons and stars from unclamped `sides` / `points`, unlike the shape generator
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:110 (pathForShape)
- scenario: a JSON scene node `{ data: { shape: 'polygon', sides: 2.5 } }` (or `sides: 0`, `-3`, `1e7`, `points: 1.5`) is passed straight to `regularPolygonPath` / `starPath`, which loop `for (i < sides)` with angle `i / sides`: 2.5 gives a 3-vertex path whose angles step by 144° (not a regular polygon), 0 or negative gives an empty closed path, 1e7 builds ten million vertices on every paint/silhouette/drawn-bounds call. `shapeGeneratorPath` (domains/paths/shapeGenerator.ts:93) answers the same question by rounding and clamping to `SHAPE_COUNT_RANGE` via `clampShapeGenerator`; the painter should route its counts through the same `count` clamp.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/domains/paths/shapeGenerator.ts
- size: line
- cause: count clamp applied on one path only
- confidence: sure

## strokedBounds counts the ribbon of a stroke that has no paint and draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path node with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint` (which `resolveStroke` keeps because it draws its heads) gets `drawnBounds` from `strokedBounds`, which tessellates the full 20-unit ribbon whenever `align !== 'inner'`, so the drawn box reaches 10 units past the whole outline although no line is drawn. `inkReach` (nodePaint.ts:30) answers the same question with `line = stroke.paint == null ? 0 : 1` and gives the line no reach. The ribbon pass should be skipped when `stroke.paint == null`. Same over-report reaches `kit:shape` (protrudes() routes marker strokes here), `kit:path-pose` and `derivedDrawnBounds`.
- evidence: read
- severity: low
- size: line
- cause: paint-less stroke not special-cased
- confidence: likely

## A group's drawn bounds miss marker heads on its `border`
- where: packages/core/src/canvas/nodeShapes/groupBoxPainter.ts:62 (groupBoxDrawnBounds)
- scenario: a group with `data.border = { paint, width: 2, markerMid: 'dot' }` (or a marker-only border, which `resolveStroke` keeps and `paintGroupBox` strokes via `commandStroke`) paints heads at the box corners, but `groupBoxDrawnBounds` always uses `outsetPoseBox`, the uniform stroke outset. `SHAPE_PAINTER.drawnBounds` decides the same rect case through `protrudes()` and measures with `strokedPoseBox` when a marker is present, so a stroked rect node and a bordered group with the same stroke report different drawn boxes; the group's is too small by the heads' reach.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/groupBoxPainter.ts, packages/core/src/canvas/nodeShapes/shapePainter.ts
- size: function
- cause: protrusion rule applied in shape painter only
- confidence: likely

## hasStroke counts an infinite width as a stroke the renderer refuses to draw
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:140 (hasStroke)
- scenario: `hasStroke({ paint, width: Infinity })` (or `{ px: Infinity }`) returns true, so Outline Stroke (path-tools outlineStrokeAction.tsx:39) is offered and text-tools reports the node stroked, while `inkReach` uses `widthHasInk` (positive *and finite*) and reports no ink, and the tessellator draws nothing. Two answers to "does this stroke have ink"; `hasStroke` should use `widthHasInk`.
- evidence: read
- severity: low
- size: line
- cause: `> 0` instead of widthHasInk
- confidence: sure

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

<!-- done: 4 findings, files read: 12 -->
