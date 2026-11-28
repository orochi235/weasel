## partsCover's framed-path cache is keyed on pose identity, so an in-place pose change picks against a stale outline
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:30 (framedPart)
- scenario: a derived node whose path is in parts (`pathFromParts`) has a pose that is rewritten in place, as pose overrides are: `nodeMemo`'s docs and `poseOverrides.invalidate` exist because an override "mutates one buffer in place rather than replacing the reference", and they clear only the nodeMemo slots via `dropPoseKeyedMemoSlots`. `FRAMED` is a module WeakMap keyed on the part path, hit when `hit.pose === pose`, and nothing invalidates it. After the pose's rotation changes in place, `partsCover` reuses the `world` path (and the cached `trimmed` outline) framed by the old rotation, so a click on the drawn part misses and a click where it used to be hits. It should reframe whenever the pose's contents change, e.g. key on the frame's values or hang the cache on a pose-keyed nodeMemo slot.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/derivedPainter.ts
- size: function
- cause: identity cache outside nodeMemo's invalidation
- confidence: likely

## strokedBounds counts the ribbon of a paintless, marker-only stroke that draws no line
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:24 (strokedBounds)
- scenario: `data.stroke = { markerEnd: …, width: 20 }` with no `paint`. `resolveStroke` keeps it (it carries a marker), and `inkReach` says "A stroke with no paint draws its heads alone, so its line reaches nowhere" (`line = 0`). `strokedBounds` never looks at `paint`: it tessellates the full 20-wide ribbon whenever `align !== 'inner'`, so `drawnBounds` from `kit:path`, `kit:path-pose`, `kit:shape` (polygon/star/markers) and `kit:derived` reports a box 10 units past the path on every side where only the head is drawn. The same decision is answered two ways: reach and pick treat the line as absent, the drawn box treats it as present. Skip the ribbon when `stroke.paint == null`.
- evidence: read
- severity: low
- size: line
- cause: paint presence not checked before tessellating
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

<!-- done: 2 findings, files read: 12 -->
