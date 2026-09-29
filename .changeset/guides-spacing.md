---
'@weasel-js/guides': patch
---

Alignment guides gain equal-spacing snaps and Figma-style segments. Additive,
with one visible default change.

- `matchSpacing` and `measureGaps` snap a box so its gap to a neighbor in its
  row or column equals a gap already between two other boxes, or center it
  between its two neighbors. Pass `getSpacingTargets` (sibling bounds) and
  `setActiveGaps` to `alignMoveBehavior` or `alignResizeBehavior` to turn it
  on; on each axis the nearer of the alignment and spacing snaps wins.
- `Guide` has an optional `span`, the stretch of the line worth drawing.
  `deriveAlignmentGuides` fills it with the extent of the boxes behind each
  line, and `matchAlignment` stretches it to reach the snapped box.
- `createGuidesLayer` draws a spanned guide as a segment with end ticks, and
  draws `getGaps` as ticked, size-labeled gap markers (`ticks`, `gapLabels`,
  `gapColor`). Derived alignment guides therefore render as segments by
  default now; `extent: 'full'` restores canvas-long lines. Guides with no
  span, such as user-placed ones, still draw across the canvas.
