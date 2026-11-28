# Findings: core.canvas.nodeShapes

## kit:shape builds a polygon or star from an unvalidated `data.sides` / `data.points`, while the shape generator rounds and clamps the same count
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:107 (pathForShape)
- scenario: a node `{ shape: 'polygon', sides: 1e9 }` (from JSON, a property panel, or a slider) → `regularPolygonPath` loops 1e9 times inside paint, silhouette and drawnBounds, which hangs the frame. `sides: 2.5` draws an uneven three-point outline (angles at i/2.5). `sides: 0` or a negative value gives an empty path. `points` for a star behaves the same way. `shapeGenerator.ts` answers the same question ("what count does a polygon/star get") with `clampShapeGenerator` → `count()` = `clamp(Math.round(v), SHAPE_COUNT_RANGE)`. The painter should go through that same clamp.
- evidence: read (geom/src/paths/builder.ts:254 loops `i < sides` with no clamp; shapeGenerator.ts:74-96)
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/domains/paths/shapeGenerator.ts
- size: line
- cause: count clamp not shared; two pathways for one decision
- confidence: sure

## strokedBounds counts the stroke ribbon even for a stroke with no paint, which draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: `resolveStroke` keeps a stroke that has no `paint` when it carries a marker, so `{ width: 20, markerEnd: 'arrow' }` on a curved path reaches drawnBounds (kit:path-pose, kit:derived, kit:path through strokedPoseBox, and kit:shape through `protrudes`). `strokedBounds` tessellates a 20-wide ribbon along the whole path and grows the box by ±10 everywhere, but the renderer draws no line. `inkReach` in nodePaint.ts uses `line = stroke.paint == null ? 0 : 1` for exactly this case. The drawn box is too large for every consumer of `drawnBounds` (fit-to-content, export bounds). The fix is to skip the ribbon block when `stroke.paint == null` and keep the heads.
- evidence: read (resolvePaint.ts:32-40; nodePaint.ts inkReach comment "A stroke with no paint draws its heads alone")
- severity: low
- size: line
- cause: paint-less stroke not special-cased; inkReach and strokedBounds disagree
- confidence: likely

## hasStroke and inkReach disagree on whether a non-finite width draws
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:140 (hasStroke)
- scenario: a painted stroke with `width: Infinity` (or `{ px: Infinity }`). `inkReach` uses `widthHasInk` (`> 0 && isFinite`), so it reports no ink, and the renderer draws nothing. `hasStroke` tests only `> 0` and answers true, so path-tools' Outline Stroke action (outlineStrokeAction.tsx:39) and text-tools' `stroked` flag treat it as a stroke to outline. `hasStroke` should call `widthHasInk`.
- evidence: read (stroke/src/tessellate/stroke.ts:191)
- severity: low
- size: line
- cause: two definitions of "width has ink"
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
