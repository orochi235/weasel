---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

`setStroke` takes a whole paint, so a gradient or pattern stroke is writable.

It accepted `{ color }` only, and merged through `paintWithColor`, which
supersedes a non-solid paint with a solid one — a gradient stroke was
unreachable even though `setStrokeOpacity` could already reach its alpha.
`paint` now wins over `color`, a color arriving later in the gesture supersedes
an earlier paint, and the stroke's width, cap, join, dash and align survive
either. New `strokeWith(paint, width?)` is `strokeOf`'s sibling for a paint
that has no color to pass.

Two fixes alongside it: `setFill` started with no `color` and no `paint` seeded
from `DEFAULT_STROKE_COLOR`, painting the selection black where
`setFillOpacity` seeds the same slot from `DEFAULT_FILL_COLOR`; and
`gradientForBounds`'s doc comment claimed a corner-to-corner linear gradient
where the body builds a left-edge-to-right-edge one.

`@weasel-js/ui` no longer exports `strokeWithColor`. It shared a name with
core's and disagreed with it — core's keeps the paint's opacity, ui's dropped
it — and nothing imported it.
