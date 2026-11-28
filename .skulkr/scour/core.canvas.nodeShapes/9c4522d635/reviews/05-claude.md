# Findings: core.canvas.nodeShapes

## strokedBounds counts the ribbon of a marker-only stroke, which paints no line
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a `kit:path` or `kit:path-pose` node with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint`. `resolveStroke` keeps it because it has a marker, and the renderer draws only the heads (`inkReach` in nodePaint.ts sets the line's reach to 0 when `paint == null`). `strokedBounds` still tessellates the full 20-unit ribbon, so `drawnBounds`, and the selection chrome and snapping built on it, grow 10 units past the outline on every side where nothing is drawn. Should skip the ribbon when `stroke.paint == null`, as `inkReach` does.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: "does the line paint" answered differently in inkReach and strokedBounds
- confidence: likely

## A derived node's framed part path is cached on pose identity, so it goes stale when a pose override mutates the pose in place
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart)
- scenario: a derived node built from `pathFromParts` has its pose animated by a per-frame override that writes into one pose buffer in place. `dropPoseKeyedMemoSlots` exists for exactly this case and clears nodeMemo's pose-keyed slots. But `FRAMED` is a module WeakMap outside nodeMemo. While the derived path is unchanged, `hit.pose === pose` stays true, so `partsCover` hit-tests the part's outline framed by the pose as it stood on the first pick. A pick then lands on the old position or rotation instead of the drawn one. Should go through nodeMemo, or compare the pose by value.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: identity cache key on a buffer that is mutated in place
- confidence: likely

## A rect's or ellipse's drawn bounds grow every side by the widest per-vertex width
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:83 (SHAPE_PAINTER.drawnBounds)
- scenario: `shape: 'rect'` with `stroke.vertexWidths: [1, 1, 40, 1]`. `protrudes` is false, so `outsetPoseBox` is used, and it takes `inkReach`'s `widestStrokeWidth` (40) as an even outset on all four sides. The ribbon is only wide near one corner, yet the selection chrome stands 20 units off every edge. `drawnBounds` is documented as tight ("Not conservative, unlike `bounds`"). Per-vertex widths should send it through `strokedPoseBox`, as polygons and stars already go.
- evidence: read
- severity: low
- size: line
- cause: protrudes() ignores vertexWidths
- confidence: likely

## hasStroke and inkReach disagree on whether a width has ink
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:143 (hasStroke)
- scenario: a stroke with `width: Infinity` (or `{ px: Infinity }`). `hasStroke` tests only `> 0` and returns true, so an outline action treats the stroke as having ink to outline. `inkReach` uses `widthHasInk` (`> 0 && finite`) and reports no reach, and the renderer draws nothing. The fix is to use `widthHasInk` in `hasStroke` as well.
- evidence: read
- severity: low
- size: line
- cause: duplicated width-has-ink test
- confidence: sure

## kit:path-pose and kit:derived tessellate the stroke again on every drawnBounds call
- where: packages/core/src/canvas/nodeShapes/pathPosePainter.ts:37 (PATH_POSE_PAINTER.drawnBounds); packages/core/src/canvas/nodeShapes/derivedPainter.ts:47 (derivedDrawnBounds)
- scenario: snapping reads `drawnBounds` for candidate nodes on every pointer move (frames.ts `drawnBounds`, "what a snap … measures"). `kit:path` and `kit:shape` memoize this through `strokedPoseBox`, so "a drag that only moves the node does not stroke it again". `kit:path-pose` and `kit:derived` call `strokedBounds` directly with no memo, so every pointer move re-tessellates every such node's full stroke, dashes and markers included. Cost grows with node count × path size on each move.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/pathPosePainter.ts, packages/core/src/canvas/nodeShapes/derivedPainter.ts, packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: function
- cause: stroked-bounds memo applied on one path only
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

<!-- done: 5 findings, files read: 12 -->
