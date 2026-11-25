## A polygon or star on a flipped pose takes a negative radius from the signed box, and overflows its box
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:109,115 (pathForShape)
- scenario: a `shape: 'polygon'` (or `'star'`) node whose rect pose has a negative width, e.g. `{ x: 100, y: 0, width: -100, height: 20 }` (flipped poses are supported: `poseBoxBounds` and `normalized` both take `Math.abs` of width/height). `r = Math.min(p.width, p.height) / 2` is `Math.min(-100, 20) / 2 = -50`, and `regularPolygonPath`/`starPath` (geom builder.ts:256,275) use it as-is, so the polygon is drawn with radius 50 inside a 100×20 box: 30 units above and below it. Should be `Math.min(|w|, |h|) / 2 = 10`. The same path feeds silhouette (picking, clip) and `strokedPoseBox`, and `bounds` assumes "every shape kind is inscribed in the pose box", so the cull box is also too small and the overflowing points vanish near the view edge.
- evidence: read
- severity: medium

## `hasStroke` reports no stroke for a painted stroke with its width omitted, which every painter draws 1 unit wide
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:132 (hasStroke)
- scenario: `data.stroke = { paint: { color: '#000' } }` with no `width` (`Stroke.width` is optional). The painters treat that as width 1 (`inkReach`'s `stroke?.width ?? 1`, `strokedBounds`'s `sized.width ?? 1`), so the stroke is drawn and grabbable. `hasStroke` reads `painted.width` as `undefined` and returns `false`, so path-tools' Outline Stroke (`outlineStrokeAction.tsx:35`) is disabled as NotApplicable for that node, and text-tools' `textOutlineOf` reports `stroked: false` for stroked text. Two answers to "does this node have a stroke" for the same data.
- evidence: read
- severity: medium

## `kit:path`'s cull bounds ignore a pose override's path, which its paint, silhouette and drawnBounds all use
- where: packages/core/src/canvas/nodeShapes/pathPainter.ts:49 (PATH_PAINTER.bounds)
- scenario: a `kit:path` node shown through a pose override that carries a `path` (`sceneOverridePathOf`, canvas/derivedPath.ts:54). `paint`, `silhouette` and `drawnBounds` all branch on `ctx.derivedPath` and use the override path "already where it is drawn"; `bounds` always returns the pose box grown by the stroke. Where the override path reaches outside the pose box (an anchor dragged out during a path edit preview), the cull (`defaultPaintBounds` → `findShapeBounds`) skips painting the node while the part outside the box is on screen. The cull's ctx (`defaultDrawOne.ts:83`) never carries `derivedPath` either, so `bounds` has no way to see it; for a derives-path node `DERIVED_PAINTER` has no `bounds` and is never culled, which is the safe answer this painter should give (`null`) when the override applies. Inferred from the code: I did not confirm that an override path can leave the shown pose box.
- evidence: read
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

<!-- done: 3 findings, files read: 12 -->
