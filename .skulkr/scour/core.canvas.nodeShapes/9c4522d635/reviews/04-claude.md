## strokedBounds counts the line's ribbon for a stroke that has no paint and only draws its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:24 (strokedBounds)
- scenario: a path-posed node, a derived node, or a `kit:shape` node with a marker has `data.stroke = { width: 20, markerEnd: { key: 'arrow', size: 4 } }` and no `paint`. `resolveStroke` keeps it because it carries a marker, and `commandStroke` passes it to the renderer with no paint, so only the arrow head is drawn. `strokedBounds` never looks at `stroke.paint`. When `align !== 'inner'` it always tessellates the full ribbon at width 20, with miter joins, and adds every ribbon vertex to the box. So `drawnBounds` (from `PATH_POSE_PAINTER.drawnBounds`, `derivedDrawnBounds`, and `SHAPE_PAINTER.drawnBounds` through `strokedPoseBox`, since a marker makes `protrudes` true) comes out 10 units wider than the path on every side. At a sharp corner the miter adds up to `miterLimit * 10` more. None of that area is painted, so selection chrome, alignment and fit-to-content sit on a box larger than what is drawn. `inkReach` in nodePaint.ts handles the same case another way: `const line = stroke.paint == null ? 0 : 1`, so the line has no reach and only the heads do. The two places disagree on whether a stroke with no paint inks its line. The fix: when `stroke.paint == null`, skip the ribbon and keep only the marker heads.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: the stroke's paint is not checked before the ribbon is tessellated
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

<!-- done: 1 findings, files read: 12 -->