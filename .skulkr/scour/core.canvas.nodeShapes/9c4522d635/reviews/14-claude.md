# Findings: core.canvas.nodeShapes

## `kit:shape` builds polygons and stars from unclamped `data.sides` / `data.points`, though `shapeGenerator` clamps the same counts
- where: packages/core/src/canvas/nodeShapes/shapePainter.ts:107 (pathForShape)
- scenario: a JSON scene holding `{ shape: 'polygon', sides: 1e9 }` makes `regularPolygonPath` loop a billion times in paint, silhouette and drawnBounds, so the tab hangs. `sides: 2.5` gives three vertices at angles `i/2.5·2π`, an irregular triangle. `sides: 0` or a negative value gives an empty path, and `points: NaN` gives an empty star. `domains/paths/shapeGenerator.ts` answers the same question with `count()`: it rounds the value and clamps it to `SHAPE_COUNT_RANGE` before calling the same builders (`clampShapeGenerator`). The built-in painter skips that and passes `d.sides ?? SHAPE_DEFAULTS.sides` straight through.
- evidence: read (`regularPolygonPath` loops `for i < sides` and does not validate; `shapeGenerator.ts:74-96`)
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/shapePainter.ts, packages/core/src/domains/paths/shapeGenerator.ts (export the count clamp)
- size: line
- cause: the count is validated in one place and not the other
- confidence: sure

## `partsCover`'s FRAMED cache is keyed on pose identity, so a pose mutated in place reuses a stale framed outline
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:30 (framedPart)
- scenario: a derived node with parts whose pose has a frame (rotation) is picked while a pose override animates it. `nodeMemo`'s own docs say per-frame pose overrides "mutate one buffer in place rather than replacing the reference", and the scene calls `dropPoseKeyedMemoSlots` so pose-keyed memos recompute. `FRAMED` is a module WeakMap keyed on the part path, and it compares only `hit.pose === pose`. That call never clears it, so the same pose object at a new rotation returns the old `world` outline and the old `trimmed` outline. The pick then tests the shape where it was, not where it is painted.
- evidence: read (`nodeMemo.ts:176-195`; `poseOverrides.ts` `read` returns one reused `held.out` per node). Whether `out.pose` is the same object across frames was not traced through `fold.probe`.
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: an identity-keyed cache outside nodeMemo's invalidation
- confidence: likely

## `strokedBounds` boxes the ribbon of a stroke that has no paint and draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: take an open path stroked `{ width: 20, markerEnd: arrow }` with no `paint`. `resolveStroke` keeps it because of the marker, and the renderer draws only the head. `inkReach` treats such a line as reaching nowhere (`line = stroke.paint == null ? 0 : 1`). `strokedBounds` still tessellates the full-width ribbon and adds its vertices, so `drawnBounds` (`kit:path`, `kit:path-pose`, `kit:derived`, polygon and star shapes) grows by about 10 units on every side of the path. The selection chrome then sits off ink that is never drawn, and the two functions answer "does the line paint" differently.
- evidence: read
- severity: low
- size: line
- cause: the ribbon is not gated on `stroke.paint`
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
