## strokedBounds counts the ribbon of a stroke that paints no line, inflating drawn bounds of marker-only strokes
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: since d52f8e7126 a stroke with no `paint` but a marker (`{ width: 20, markerEnd: … }`, SVG `stroke="none"` with markers) survives `resolveStroke` and draws its heads alone; `inkReach` gives it no line width. `strokedBounds` still tessellates the full ribbon whenever `align !== 'inner'`, so `drawnBounds` — which `drawnBoundsOf` puts the selection chrome on, documented as tight — reaches `width/2` (or `width` for `align: 'outer'`) past the outline on every side where nothing is drawn. Hits `kit:path` / `kit:shape` (via `strokedPoseBox`, `protrudes` sends every marker stroke there), `kit:path-pose` and `kit:derived` (`derivedDrawnBounds`). Should skip the ribbon when `stroke.paint == null` and box only the marker heads, matching `inkReach`'s `line = 0`.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: paintless-marker change not carried into strokedBounds
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
