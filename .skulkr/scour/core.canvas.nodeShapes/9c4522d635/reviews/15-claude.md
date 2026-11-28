# Findings: core.canvas.nodeShapes

## strokedBounds pads an absolute path's drawn box by 2^-16 of its distance from the origin, far coarser than float32
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:67 (flattenFor, FINEST)
- scenario: `FINEST = 2 ** -16` is applied to `size`, which is the largest absolute coordinate, so it measures distance from the origin, not the path's extent. float32 resolves 2^-24 of a coordinate, so this is 256× coarser than the comment says. `PATH_POSE_PAINTER.drawnBounds` and `derivedDrawnBounds` pass absolute paths. Example: a 100-unit path-posed ellipse at x = 1e5, viewed at zoom 10, has a view tolerance of 0.05 and finest = 1.53. So `flattenFor` returns `pad: 1.53`, and every ribbon vertex grows the box by 1.53 world units on each side. The selection chrome then sits about 15 px off the stroke. At x = 1e6 it is 15 world units, which is 150 px at zoom 10. It should stay tight to about the renderer's own tolerance. (`strokedPoseBox` is unaffected because it strokes at the origin.)
- evidence: read (arithmetic on DEFAULT_FLATTEN_TOLERANCE = 0.5 and FINEST)
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: function
- cause: precision floor scaled by distance from origin at 2^-16 instead of float32's 2^-24 (or the path's own extent)
- confidence: likely

## derivedPainter's FRAMED cache keys on pose identity, so a pose buffer mutated in place leaves picking on a stale framed path
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart), used by partsCover:136
- scenario: Take a node whose derived path is in parts (`pathFromParts`), with a framed pose (rotation or transform) driven by a per-frame pose override. Overrides mutate one pose object in place each frame, which is why `nodeMemo` has `dropPoseKeyedMemoSlots` (see poseOverrides.ts `invalidate`). `framedPart` hits on `hit.pose === pose` and returns `world` framed by the previous frame's rotation. Its `trimmed` outline is reused under the same trim key too. So `partsCover` hit-tests the part where it was, not where it is drawn. Nothing invalidates FRAMED: it is a module WeakMap, outside nodeMemo, so `dropPoseKeyedMemoSlots` never reaches it.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: cache keyed on mutable pose object identity, outside the nodeMemo invalidation path
- confidence: likely

## hasStroke and inkReach answer "does this width draw ink" two different ways
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:139 (hasStroke)
- scenario: `hasStroke` tests `width > 0`, while `inkReach` (and the tessellator) use `widthHasInk`, which also requires a finite width. For `{ paint, width: Infinity }` or `{ px: Infinity }`, `hasStroke` says there is a stroke to outline (so an outline-stroke action runs on it). Meanwhile `inkReach` reports zero reach, and the renderer draws nothing.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts
- size: line
- cause: duplicate width-has-ink predicate
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

<!-- done: 3 findings, files read: 12 -->
