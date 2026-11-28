## strokedBounds counts the line's ribbon for a marker-only stroke, which the renderer draws as heads alone
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a `kit:path` node (or `kit:shape` star/polygon, `kit:path-pose`, a derived path) with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint`. `resolveStroke` keeps it because it has a marker, and `commandStroke` passes it through "to draw its heads alone" (renderer/src/patterns/commandPaint.ts:36–42), so no line is drawn. `strokedBounds` checks only `width > 0`, then tessellates the full 20-unit ribbon along the path and adds it to the box. `drawnBounds`, and the selection chrome on it, grows by 10 units on every side of the path where no ink is. `inkReach` answers the same question the other way: `const line = stroke.paint == null ? 0 : 1` (nodePaint.ts:30) zeroes the line's reach, so picking and `outsetPoseBox` leave the line out while `strokedBounds` puts it in.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: ribbon tessellated without checking `stroke.paint`
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
