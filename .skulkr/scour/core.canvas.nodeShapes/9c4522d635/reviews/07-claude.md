## `strokedBounds` counts the ribbon of a stroke with no paint, which draws only its marker heads
- where: packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)
- scenario: a path node with `stroke: { markerEnd: 'arrow', width: 8 }` and no `paint` (kept by `resolveStroke` because it carries a marker). The renderer draws the heads alone (`inkReach`'s "A stroke with no paint draws its heads alone"; pdf's `writeNative` returns before the line when `!paint`), but `strokedBounds` still tessellates the full 8-unit ribbon whenever `align !== 'inner'`. `drawnBounds` (pathPainter via `strokedPoseBox`, pathPosePainter, `derivedDrawnBounds`) then reports a box grown by the undrawn line's half-width and joins, so selection chrome sits off the visible ink. Should skip the ribbon when `stroke.paint == null`, as `inkReach` zeroes `line`.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/strokedBounds.ts
- size: line
- cause: paint-less stroke not distinguished from a painted one in the ribbon pass
- confidence: likely

## `hasStroke` re-answers `strokeHasInk` and disagrees on a non-finite dash
- where: packages/core/src/canvas/nodeShapes/nodePaint.ts:136 (hasStroke)
- scenario: a node stroked `{ paint: {color:'#000'}, width: 2, dash: [Infinity, 1] }` (or any dash `dashPattern` calls `'non-finite'`). The renderer and pdf draw no line for it, and `@weasel-js/paint`'s `strokeHasInk` (paintKey.ts:71) answers false; `hasStroke` answers true, so path-tools' Outline Stroke (`outlineStrokeAction.tsx:39`) and text-tools' `textOutline.ts:15` treat the node as stroked and offer to outline a line that is not drawn. Same question, two definitions; `hasStroke` should be `strokeHasInk`.
- evidence: read
- severity: low
- fix: packages/core/src/canvas/nodeShapes/nodePaint.ts, packages/path-tools/src/outlines/outlineStrokeAction.tsx, packages/text-tools/src/node/textOutline.ts
- size: function
- cause: duplicated predicate drifted from its paint-package original
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
