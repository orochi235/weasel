## strokedBounds measures the line's ribbon for a heads-only stroke, which draws no line
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path node with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint`. `resolveStroke` keeps it (a marker still draws its heads), and `inkReach` treats its line as reaching nowhere (`line = stroke.paint == null ? 0 : 1`). But `strokedBounds` tessellates the full 20-unit ribbon whenever `align !== 'inner'` without checking `stroke.paint`, so `derivedDrawnBounds`, `PATH_POSE_PAINTER.drawnBounds` and `strokedPoseBox` (kit:path, polygon/star kit:shape) report a drawn box 10 units past every side of the outline. Selection chrome sits on ink that is never painted. Picking and drawn bounds give two different answers to "does this stroke's line put ink down". It should skip the ribbon when `stroke.paint == null` and keep only the marker heads.
- evidence: read (resolvePaint.ts resolveStroke, nodePaint.ts inkReach)
- severity: low

## hasStroke duplicates strokeHasInk but drops its non-finite-dash test
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:136 (hasStroke)
- scenario: `@weasel-js/paint`'s `strokeHasInk` answers the same question: it has a paint and its width (or `{ px }`) is above 0. It also returns false when `dashPattern(dash) === 'non-finite'`, a stroke that draws nothing. `hasStroke` is a second copy without that test, so a stroke with a non-finite dash still counts as stroked for `outlineStrokeAction` (path-tools) and `textOutline`'s `stroked`. "Outline stroke" is then offered for, and runs on, a stroke that paints no ink. The two copies answer one decision differently. `hasStroke` should delegate to `strokeHasInk`.
- evidence: read (paint/src/paintKey.ts strokeHasInk, callers in path-tools/outlineStrokeAction.tsx:39 and text-tools/textOutline.ts:15)
- severity: low

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

<!-- done: 2 findings, files read: 12 -->
