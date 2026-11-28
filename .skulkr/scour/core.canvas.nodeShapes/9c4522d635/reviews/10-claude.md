# Findings: core.canvas.nodeShapes

## strokedBounds measures the line ribbon of a stroke with no paint, which since d52f8e7126 draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path, path-pose or derived node with `stroke: { width: 20, markerEnd: … }` and no `paint` (now kept by `resolveStroke`/`pathPaintOf` because it carries a marker). The renderer draws only the arrowhead, and `inkReach` treats the line as reaching nowhere (`line = stroke.paint == null ? 0 : 1`). `strokedBounds` still tessellates the 20-wide ribbon whenever `align !== 'inner'`, so `drawnBounds` (`derivedDrawnBounds`, `PATH_POSE_PAINTER.drawnBounds`, `strokedPoseBox` through `kit:path` and through `kit:shape`, where a marker makes `protrudes` true) comes back 10 units wider on every side than what is painted, and the selection chrome sits off the ink. `outsetPoseBox` (through `strokeOutsetPerAxis` → `inkReach`) gives the tight answer for the same stroke, so the two paths disagree.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: paintless-stroke rule added to inkReach but not to strokedBounds
- confidence: likely

## partsCover's FRAMED cache is keyed on the pose reference, so an in-place pose override picks against a stale framed outline
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:30 (framedPart)
- scenario: a derived node built from parts, with a framed pose (rotation/transform) that a per-frame pose override changes by mutating one buffer in place. `poseOverrides.invalidate` calls `dropPoseKeyedMemoSlots` for exactly this case, but `FRAMED` is a module WeakMap outside `nodeMemo`, and `hit.pose === pose` still holds after the mutation. `partsCover` then hit-tests the part's `world` path and its cached trimmed outline for the old frame, so picking misses the shape where it is drawn and hits where it was.
- evidence: read (the override's in-place mutation is taken from nodeMemo.ts's doc for `dropPoseKeyedMemoSlots`, not traced through a pick of a derived node)
- severity: low
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: identity cache outside nodeMemo's pose-drop signal
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

<!-- done: 2 findings, files read: 12 -->
