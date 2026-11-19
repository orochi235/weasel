# Audit round 39: core.canvas.nodeShapes

## A mirrored pose makes a polygon or star overshoot its box: the radius is min(width, height)/2 with signed sides
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:109 and :115 (pathForShape)
- scenario: `{ shape: 'polygon' }` at pose `{ x: 0, y: 0, width: -100, height: 10 }` (a pose flipped by a resize past its edge; `poseBoxBounds`, `normalized` and `drawnSize` all handle negative sizes, so callers can produce them). `Math.min(-100, 10) / 2` is -50, so `regularPolygonPath` draws a radius-50 polygon (only negated) about a center whose box is 10 tall: it reaches 45 units above and below the box. `bounds` claims "every shape kind is inscribed in the pose box", so the cull drops it while those parts are still on screen, and `silhouette`/picking/clipping use the oversized outline. It should use `Math.min(Math.abs(width), Math.abs(height)) / 2`. A negative radius also turns the polygon or star 180°, so it no longer matches its unmirrored form, which `ellipsePath` and the rect path do.
- evidence: read (geom `regularPolygonPath`/`starPath` use `radius` raw, packages/geom/src/paths/builder.ts:256–285)
- severity: medium

## hasStroke calls a stroke with paint and no width "no stroke", but every painter draws it 1 unit wide
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:132 (hasStroke)
- scenario: a node with `data.stroke = { paint: { color: '#000' } }` (no `width`, which is optional on `Stroke`, packages/paint/src/paint.ts:176). `inkReach` (`stroke?.width ?? 1`), `strokedBounds` (`sized.width ?? 1`) and paint.ts:281 all read it as width 1, and it paints as a visible 1-unit stroke. But `hasStroke` returns `false` because `width` is `undefined`, so path-tools' Outline Stroke (packages/path-tools/src/outlines/outlineStrokeAction.tsx:35) is disabled with NotApplicable for that node. Two answers to "does this stroke draw" that disagree.
- evidence: read
- severity: medium

## kit:path-pose drawnBounds drops the fill whenever the stroke ribbon doesn't run the whole outline (trim, dash, or inner stroke with markers)
- where: packages/core/src/canvas/nodeShapes/pathPosePainter.ts:35 (drawnBounds)
- scenario: a filled closed path pose with `stroke: { paint, width: 2, trim: { start: 0, end: 0.1 } }`. `strokedBounds` tessellates only the drawn 10% arc, returns that arc's small box, and `?? boundsOfPath(pose)` never fires because the result is non-null. The selection chrome (`drawnBoundsOf`) wraps one arc while the fill covers the whole shape. Same with a sparse dash, or `align: 'inner'` plus a marker (only the marker head's box comes back). `strokedPoseBox` unions the pose box for exactly this reason; this painter should union `boundsOfPath(pose)` too.
- evidence: read
- severity: medium

## kit:derived drawnBounds ignores the fill, so a fill-only, inner-stroked or trimmed derived path puts its chrome on the placeholder pose
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:46 (derivedDrawnBounds)
- scenario: a derived node (`dependsOn` + `derivePath`) with `fill` set and `stroke: null`. `derivedDrawnBounds` returns `null` ("no stroke"), and the `drawnBounds` contract (nodeShapeTypes.ts:124–127) reads `null` as "the pose box". For a derived node that box is the zero-sized placeholder (the painter's own doc says so), so the selection chrome collapses to a point while the fill paints across the whole derived path. The same happens with `align: 'inner'` and no markers (`strokedBounds` → null), and a trimmed or dashed stroke comes back as only the drawn stretch, which leaves out the fill. With parts, a fill-only part contributes nothing to the union. PATH_PAINTER.drawnBounds hands any `ctx.derivedPath` to this function (pathPainter.ts:52), so it has the same problem. It should union `boundsOfPath(path)` (or each filled part's bounds) whenever a fill resolves.
- evidence: read
- severity: medium

## kit:path's cull bounds ignore ctx.derivedPath, while its paint, silhouette, and drawnBounds draw that path
- where: packages/core/src/canvas/nodeShapes/pathPainter.ts:49 (bounds)
- scenario: a `kit:path` node gets a path from `ctx.derivedPath`, "a pose override's path… already where it is drawn" (pathPainter.ts:30). `paint` delegates to DERIVED_PAINTER and draws that path, and `silhouette` and `drawnBounds` read it too, but `bounds` still returns the pose box grown by the stroke. If the override path reaches outside the pose box, `paintMissesView` culls the node once the pose box leaves the view, even though the drawn path is still on screen. `bounds` should check `ctx?.derivedPath` the way its siblings do, and return its stroked bounds or `null` (always paint, as DERIVED_PAINTER does by having no `bounds`). Partly inferred: `defaultPaintBounds` (defaultDrawOne.ts:83) builds the cull ctx with no derivedPath at all, so the cull can't see the override even if `bounds` handled it; I didn't trace which producers give a `kit:path` node an override path that leaves its pose box.
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

<!-- done: 5 findings, files read: 12 -->
