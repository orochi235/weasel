## `hasStroke` re-derives `strokeHasInk` and drops its non-finite-dash test
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:132 (hasStroke)
- scenario: `hasStroke` is a line-for-line copy of `@weasel-js/paint`'s `strokeHasInk` (paintKey.ts:71) except that it omits `dashPattern(painted.dash) !== 'non-finite'`. A stroke `{ paint, width: 2, dash: [Infinity, 1] }` (or a NaN entry) gets `strokeHasInk → false`, so the renderer treats it as drawing nothing, while `hasStroke → true`, so an action turning ink into geometry outlines a stroke that never draws. The same question is answered two ways.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts (make `hasStroke` call `strokeHasInk`, or drop it in favor of that)
- size: line
- cause: duplicated predicate drifted
- confidence: sure

## `strokedBounds` counts the line's ribbon for a stroke with no paint that draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:24 (strokedBounds)
- scenario: `resolveStroke` keeps a stroke that has no `paint` but does have a marker (`{ width: 8, markerEnd: { key: 'arrow', size: 4 } }`), and the renderer draws only its heads. `inkReach` in nodePaint.ts reflects that (`const line = stroke.paint == null ? 0 : 1`), but `strokedBounds` tessellates the full 8-wide ribbon anyway (`align !== 'inner'` is the only gate) and adds its vertices to the box. `drawnBounds` for `kit:path`, `kit:path-pose`, `kit:derived` and a shape with a marker therefore sits up to half the width, plus the cap and miter reach, outside what is painted, so selection chrome is drawn loose around an arrow-only path. The fix is to skip the ribbon when `stroke.paint == null`.
- evidence: read
- severity: low
- size: line
- cause: paint-less stroke not gated before ribbon tessellation
- confidence: likely

## `outsetPoseBox` falls short for a `{ px }` mitered rect under a skewed screen map
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:139 (outsetPoseBox), via shapePainter.ts:83 (SHAPE_PAINTER.drawnBounds)
- scenario: a `shape: 'rect'` node (or a group box border) with `stroke: { width: { px: 10 }, join: 'miter' }`, viewed through a `ctx.screen` map that has shear (a skewed pose frame). The renderer builds the `{ px }` ribbon on screen, where the rect's corners are no longer right angles. At the acute corners the miter spikes reach past the disk-support outset that `strokeOutsetPerAxis` adds, by up to `miterLimit × w/2`. The "exact for a rect" claim holds only when the map keeps angles. Expected: under a non-conformal map, route the rect through `strokedPoseBox` the way polygon and star are routed.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/canvas/nodeShapes/groupBoxPainter.ts
- size: function
- cause: right-angle assumption broken by a shearing screen map
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
