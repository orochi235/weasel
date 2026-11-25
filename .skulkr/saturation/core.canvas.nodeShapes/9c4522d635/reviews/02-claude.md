# Findings: core.canvas.nodeShapes

## strokedBounds measures the ribbon of a stroke that has no paint and only draws marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: `resolveStroke` keeps a stroke with `paint: null` when it carries a marker (`packages/paint/src/resolvePaint.ts:39`), and such a stroke paints only its heads. `inkReach` handles this by giving the line zero reach (`line = stroke.paint == null ? 0 : 1`). `strokedBounds` only checks the width before it tessellates the full ribbon and adds every vertex to the box. Take an arc or a wavy path with `stroke: { paint: null, width: 20, markerEnd: … }`. Its `drawnBounds` (from `kit:path`, `kit:path-pose`, `kit:derived`, or `kit:shape` through `protrudes`) grows by 10 units at every bulge the heads don't reach. The selection chrome then sits around ink that is never drawn.
- evidence: read
- severity: low

## A group's box border gets a uniform outset, while kit:shape measures the same rect when its stroke protrudes
- where: packages/core/src/canvas/nodeShapes/groupBoxPainter.ts:61 (groupBoxDrawnBounds)
- scenario: `groupBoxDrawnBounds` always returns `outsetPoseBox(pose, border)`. `kit:shape` handles the same rect outline differently (`shapePainter.ts:74`): when `protrudes(stroke)` is true (a marker head, or a square cap on a dashed or trimmed stroke), it switches to `strokedPoseBox`, because an even outset no longer holds. Take a group with `border: { paint, width: 4, markerMid: <arrow> }`, or a dashed border with square caps. Its drawn bounds stop at width/2 past the box, while the heads paint further out, so the selection chrome cuts through the painted border. Two places give different answers to the same question.
- evidence: read
- severity: low

## The FRAMED pick cache is keyed on pose identity, so a pose buffer mutated in place picks against a stale outline
- where: packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart), used by partsCover
- scenario: `framedPart` reuses `hit.world` (and the trimmed outline) whenever `hit.pose === pose`. Per-frame pose overrides mutate one pose buffer in place, which is why `dropPoseKeyedMemoSlots` exists for `nodeMemo`. The FRAMED WeakMap is outside that memo and nothing drops its entries. Take a derived node in parts whose pose frame (for example its rotation) is animated by mutating the override buffer. Picks keep hitting the part paths framed by the first frame's pose, while painting follows the live pose.
- evidence: read
- severity: medium

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
