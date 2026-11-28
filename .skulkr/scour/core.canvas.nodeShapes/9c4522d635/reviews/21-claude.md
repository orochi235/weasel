## A derived path in parts reports the node's own ink, not its parts', so the pick index and region picks miss what the parts paint
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:118 (DERIVED_PAINTER.ink); same in packages/core/src/canvas/nodeShapes/pathPainter.ts:46 (PATH_PAINTER.ink with `ctx.derivedPath`)
- scenario: a `derivePath` returns `pathFromParts([{ path, stroke: { paint, width: 20 } }])` on a node whose own `data` has no stroke and no fill. `paint` and `partsCover` draw and pick each part in its own stroke, but `ink` resolves only `data.stroke`/`data.fill`, so it answers `{ filled: false, outset: 0 }`. `nodeBroadBox` (pickIndex/nodeBroadBox.ts:68-73) grows the derived path's bounds by that outset of 0, so a click on the outer half of the 20-unit part stroke (up to 10 units outside the path's bounds) is dropped by the broad phase before `partsCover` ever sees it, and `hitTestArea`'s `filled()` (deps/hitTestArea.ts:163) treats a part-filled shape as unfilled for marquee/lasso. Should report the union over parts: any part filled, and the widest part reach.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts, packages/core/src/canvas/nodeShapes/pathPainter.ts
- size: function
- cause: ink ignores derivedPartsOf; part paint resolved in paint/pick/drawnBounds only
- confidence: likely

## kit:shape builds polygons and stars from raw `data.sides` / `data.points`, while the shape generator clamps and rounds the same counts
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:107-118 (pathForShape)
- scenario: a scene loaded from JSON with `{ shape: 'polygon', sides: 2.5 }` paints an irregular triangle (`regularPolygonPath` loops `i < 2.5`, angles at 0, 0.4·2π, 0.8·2π); `sides: 0` or `NaN` paints an empty path; `sides: 1e8` allocates 1e8 vertices on every paint, silhouette, and drawnBounds call (hang). `shapeGeneratorPath` (domains/paths/shapeGenerator.ts:74-96) answers the same question with `clamp(Math.round(v), SHAPE_COUNT_RANGE…)`. Should pass the counts through the same `count` clamp.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/domains/paths/shapeGenerator.ts (export the count clamp)
- size: line
- cause: unclamped user count; two pathways for one decision
- confidence: sure

## An infinite stroke width is "no ink" to inkReach but tessellated by strokedBounds and counted by hasStroke
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:26 (strokedBounds); packages/core/src/canvas/nodeShapes/nodePaint.ts:146 (hasStroke)
- scenario: `stroke: { paint, width: Infinity }`. `inkReach` uses `widthHasInk` (`> 0 && isFinite`) and reports no reach, matching the renderer drawing nothing; `strokedBounds` only checks `!(width > 0)`, so it tessellates an infinite ribbon and its `Box` comes out with Infinity/NaN edges, which `strokedPoseBox` and `derivedDrawnBounds` hand to selection chrome as the drawn box; `hasStroke` says `true` (`width > 0`), so an outline-stroke action outlines a stroke that paints nothing. All three should use `widthHasInk`.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts, packages/core/src/canvas/nodeShapes/nodePaint.ts
- size: line
- cause: width-has-ink decided three ways
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
