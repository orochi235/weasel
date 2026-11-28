## strokedBounds counts the ribbon of a stroke that paints no line, only marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path node with `stroke: { width: 20, markerEnd: 'arrow' }` and no `paint`. `resolveStroke` keeps it because it carries a marker, and the renderer draws only the arrow head. `inkReach` agrees: it multiplies the line's reach by `line = stroke.paint == null ? 0 : 1`. `strokedBounds` never checks `paint`, so it tessellates the full 20-wide ribbon. `kit:path`'s and `kit:path-pose`'s `drawnBounds`, `derivedDrawnBounds`, and `kit:shape`'s `drawnBounds` (which `protrudes` sends here for any marker) then report a box 10 units past the outline on every side. The selection chrome sits on ink that is never drawn. It should skip the ribbon when `stroke.paint == null` and keep only the heads.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: paint-less stroke not checked; decision answered differently than inkReach
- confidence: sure

## hasStroke duplicates paint's strokeHasInk but drops its dash and finiteness checks
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:136 (hasStroke)
- scenario: `@weasel-js/paint`'s `strokeHasInk` (paintKey.ts:71) answers the same question and also returns false when `dashPattern(dash) === 'non-finite'`. `inkReach`'s `widthHasInk` also rejects a non-finite width. `hasStroke` checks only `> 0`. Two cases follow: a stroke with `width: Infinity`, and a painted stroke whose dash pattern is non-finite. In both, `hasStroke` returns true where the other two say the stroke draws nothing. path-tools' `outlineStrokeAction` and text-tools' `textOutline` then enable "outline stroke" for a stroke with no ink. `hasStroke` should be `strokeHasInk`.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts, packages/path-tools/src/outlines/outlineStrokeAction.tsx, packages/text-tools/src/node/textOutline.ts
- size: function
- cause: duplicate predicate drifted from paint's
- confidence: sure

## derivedPainter's FRAMED cache is keyed on pose identity, so an override that rewrites its pose in place gets a stale world path
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart)
- scenario: `nodeMemo` notes that per-frame pose overrides mutate one buffer in place, and `poseOverrides.invalidate` calls `dropPoseKeyedMemoSlots` to compensate. `FRAMED` is a module WeakMap keyed on the part's path. It reuses its entry whenever `hit.pose === pose`, and nothing drops it. Case: a derived node, with parts, has its rotation animated through a pose override that rewrites the same pose object. `partsCover` keeps returning the world path, and the trimmed outline, framed at the first frame's rotation. Picks then land where the shape was, not where it is drawn. Expected: the cache follows pose changes, as `trimmedOutlineOf` in NodeShape.ts does by living in `nodeMemo`.
- evidence: read (in-place override mutation taken from nodeMemo.ts's doc and poseOverrides.ts; not traced to a derived node's override)
- severity: low
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: identity-keyed cache outside nodeMemo's invalidation
- confidence: likely

## kit:path-pose's drawnBounds tessellates the whole stroke again on every call
- where: packages/core/src/canvas/nodeShapes/pathPosePainter.ts:37 (PATH_POSE_PAINTER.drawnBounds)
- scenario: `kit:path` and `kit:shape` route `drawnBounds` through `strokedPoseBox`, which memoizes the stroked box on the node by size, stroke and view. `kit:path-pose` calls `strokedBounds(pose, …)` directly, so every `drawnBoundsOf` call on a selected path-posed node runs a full `tessellateStroke` (plus markers) over the path, every frame the chrome redraws. It should memoize via `nodeMemo` keyed on pose and stroke, as the other painters do.
- evidence: read
- severity: low
- size: function
- cause: missing memo on one painter's path
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

<!-- done: 4 findings, files read: 12 -->
