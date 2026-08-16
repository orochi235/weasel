---
'@weasel-js/core': patch
'@weasel-js/font': patch
'@weasel-js/hud': patch
'@weasel-js/svg': patch
---

Five unrelated backlog fixes.

The specificity tuple's `phase` dimension is graded rather than binary: an
atom scores 2 when both its channel and its lifecycle state are concrete, 1
when one axis is wildcarded, and 0 for `*:*`, which matches everything an
undeclared phase would have matched. An atom list takes the minimum, since
`matchPhase` is a union. No existing binding reorders — the four ambient
actions hold at 1, and the polygon and star tools' `phase: 'engaged'` wheel
bindings rise to 2, widening a gap they already won.

The loupe's pixel mode no longer drops the end of a fast drag: a readback
requested while `createImageBitmap` is in flight is remembered and re-run when
that one settles, instead of being discarded.

SVG unpack applies the fit-clamp to text on both axes. `fontSize` now scales
with the file, and a text node's box width is estimated from its longest line
instead of inheriting the parser's unbounded-width wrap sentinel — which,
folded into the union AABB, had been clamping any external SVG containing
text down to a speck. That sentinel is now the exported `UNBOUNDED_TEXT_WIDTH`
rather than a bare `99999`, so a consumer reading `SvgTextNode.width` can tell
a measurement from a placeholder.

The debug overlay takes per-feature line widths and dashes through
`DebugConfig.strokes`, alongside the colors `DebugConfig.theme` already
carried. Defaults are unchanged.

A `.dfont` face declines the outline tier by name. Datafork TrueType holds its
sfnt tables inside a Macintosh resource map, which is still not unpacked, but
it is now recognized before parsing and reported as itself rather than dying
on an unrecognized-signature message that never says which format it saw.
