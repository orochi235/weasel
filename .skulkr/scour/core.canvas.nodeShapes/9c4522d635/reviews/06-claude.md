## partsCover's FRAMED cache serves a stale framed outline after an in-place pose override
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:30 (framedPart)
- scenario: a derived node whose pose has a frame (rotation/matrix) is driven by a per-frame pose override, which mutates one pose buffer in place (`poseOverrides.ts` calls `dropPoseKeyedMemoSlots` for exactly this reason). `framedPart` keys its entry on the part path plus `hit.pose === pose`; the reference never changes, so picks keep testing the outline framed through the first frame's pose (and its cached trimmed outline) while the node paints at the new one. The nodeMemo slots are dropped, but this module-level WeakMap is outside nodeMemo and never invalidated.
- evidence: read
- severity: medium
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: identity cache key blind to in-place pose mutation
- confidence: likely

## A paint-less stroke that only carries markers still has its whole line counted in drawn bounds
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: `data.stroke = { width: 10, markerEnd: 'arrow' }` (no `paint`). `resolveStroke` keeps it for its heads, and `inkReach` says "its line reaches nowhere" (`line = 0`), but `strokedBounds` tessellates the full ribbon regardless of `stroke.paint`, so `drawnBounds` of `kit:path`, `kit:shape` polygons/stars, `kit:path-pose` and `kit:derived` grow by half the width plus caps/joins along the whole outline, where nothing is painted. Two answers to whether that line paints.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: ribbon tessellated without checking stroke.paint
- confidence: sure

## A paint-less marked stroke makes its whole invisible outline grabbable at the head's reach
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:33 (inkReach)
- scenario: same stroke as above, head reach R. `sides(full, headReach)` gives `outset = headReach` even with `line = 0`, and `inkCovers` applies `outset` along the entire outline (`strokeHitTest(path, …, reach)`), so a click anywhere within R of the undrawn line picks the node, though only the heads are visible. The comment beside it says the line "reaches nowhere".
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts, packages/core/src/canvas/nodeShapes/pickOutline.ts
- size: design
- cause: head reach folded into a per-outline reach
- confidence: likely

## hasStroke and inkReach answer "does this width draw" differently
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:126 (hasStroke)
- scenario: a stroke with `width: Infinity` (or `{ px: Infinity }`): `hasStroke` tests `> 0` and reports a stroke to outline, while `inkReach` uses `widthHasInk` (`> 0 && finite`) and reports no ink, so an action outlining ink acts on a stroke the pick and bounds treat as drawing nothing. One decision, two definitions.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts
- size: line
- cause: duplicated width-has-ink test
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

<!-- done: 4 findings, files read: 12 -->
