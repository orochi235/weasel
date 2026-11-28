# Findings: core.canvas.nodeShapes

## strokedBounds counts the full ribbon of a paintless marker stroke, which draws only its heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:24 (strokedBounds)
- scenario: since d52f8e7 `resolveStroke` keeps a stroke with no `paint` that carries a marker, and the renderer draws its heads alone. `strokedBounds` still tessellates the line's ribbon at its full width (`align !== 'inner'` branch) for it. A `kit:path` / `kit:path-pose` / `kit:derived` node, or a `kit:shape` (which `protrudes` sends to `strokedPoseBox` for any marker) with `stroke: { width: 20, markerEnd: … }` and no paint, reports a `drawnBounds` grown by 10 units on every side that nothing paints. `inkReach` in nodePaint.ts answers the same question correctly (`line = stroke.paint == null ? 0 : 1`), so the drawn box and the ink reach disagree for one stroke.
- evidence: read (nodePaint.ts inkReach; paint/src/resolvePaint.ts resolveStroke; commit d52f8e7)
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: paintless-marker case not carried into strokedBounds
- confidence: likely

## A polygon or star on a mirrored pose is not mirrored
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:98 (pathForShape)
- scenario: a `shape: 'polygon', sides: 3` node resized past its opposite edge gets a negative `width` (or `height`). `pathForShape` centers the polygon and takes `Math.abs` for the radius, so the triangle keeps pointing the same way, while the rect and `kit:path` (via `pathInPoseBox`) mirror with the pose and the fill's box-relative gradient (`commandFill(declaredFill, pose)`) is baked onto the mirrored box. The shape and its gradient flip relative to each other.
- evidence: read
- severity: low
- size: function
- cause: pose sign dropped for polygon/star
- confidence: likely

## `sides` / `points` from data are unvalidated
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:103 (pathForShape)
- scenario: scene JSON with `sides: 5.5` builds 6 vertices at angles `i/5.5·2π`, an irregular hexagon instead of anything regular; `sides: 0` or negative builds a path with no `moveTo` before `close()`; a huge value (`1e8`) loops and allocates that many vertices on every paint, silhouette and drawn-bounds call. `regularPolygonPath`/`starPath` (geom builder.ts:254, 273) loop `i < sides` with no clamp or rounding.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts (or packages/geom/src/paths/builder.ts)
- size: line
- cause: unclamped count from user data
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
