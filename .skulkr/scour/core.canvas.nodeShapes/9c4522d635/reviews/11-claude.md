# Findings: core.canvas.nodeShapes

## `kit:derived`'s `ink` reads the node's own paint for a path in parts, so the pick index and area select disagree with what the parts paint
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:116 (DERIVED_PAINTER.ink); same in packages/core/src/canvas/nodeShapes/pathPainter.ts:44 (PATH_PAINTER.ink with a parts `derivedPath`)
- scenario: a derived node made by `pathFromParts` whose own `data.stroke` is null and `data.fill` null, with a part stroked 20 wide and another part filled. `paint` and `partsCover` use each part's paint (`resolvePartPaint`), but `ink` reports `filled: false, outset: 0`. `nodeBroadBox` (pickIndex/nodeBroadBox.ts:68) grows the broad box by that 0 outset, so a click 8 units outside the path on the 20-wide part's stroke is culled by the index before `partsCover` (which would accept it) ever runs. `hitTestArea` (deps/hitTestArea.ts:163) reads `filled` from the same `ink`, so a marquee in `intersects` mode drawn wholly inside a filled part treats the node as an unfilled outline and misses it. Should: for a parts path, `ink` reports the union over parts (filled if any part fills, outset/inset/outsetPx the max of each part's `inkReach`).
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts, packages/core/src/canvas/nodeShapes/pathPainter.ts
- size: function
- cause: ink ignores derivedPartsOf where paint/pick/drawnBounds honor it
- confidence: likely

## `strokedBounds` counts the ribbon of a marker-only stroke, which draws no line
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path node with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint`. `resolveStroke` keeps it (it has a marker), the renderer draws only the head, and `inkReach` (nodePaint.ts:30) says so explicitly (`line = stroke.paint == null ? 0 : 1`). But `strokedBounds` tessellates the full 20-wide ribbon whenever `width > 0`, so `drawnBounds` for `kit:path`, `kit:path-pose`, `kit:derived` and polygon/star `kit:shape` grows by 10 on every side of the outline, while the same stroke on a rect/ellipse (via `outsetPoseBox` → `inkReach`) does not. Should: skip the ribbon when `stroke.paint == null`, as `inkReach` does.
- evidence: read
- severity: low
- size: line
- cause: paint-less-stroke decision made in inkReach but not in strokedBounds
- confidence: likely

## `hasStroke` and `inkReach` answer "does this width draw" two ways
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:131 (hasStroke)
- scenario: a stroke with paint and `width: Infinity` (or `{ px: Infinity }`). `inkReach` uses `widthHasInk` (finite and > 0) and reports no ink; `hasStroke` uses bare `> 0` and reports a stroke to outline, so an outline-stroke action would try to outline a stroke the renderer and picker treat as drawing nothing. Should: `hasStroke` calls `widthHasInk`.
- evidence: read
- severity: low
- size: line
- cause: duplicated width-has-ink predicate
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
