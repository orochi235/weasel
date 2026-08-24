---
'@weasel-js/core': patch
---

Default an unset miter limit to 4, not 10.

A stroke that sets no `miterLimit` used Canvas2D's 10. The SVG serializer omits
the attribute for an unset field, so the same stroke exported and opened
anywhere else renders at SVG's default of 4 — the kit disagreed with its own
export format, and re-importing the file did not reconcile them.

10 also lets an acute corner throw a miter spike four times the half-width. A
stroked capital W put one in the middle of the letter, from the apex of a V
most of the way down: measured at 7.99 units out on a half-width of 2, and
inside the letterform where a bounding box never sees it. Glyph outlines are
where this shows first because a type designer's sharpest vertices were never
drawn to be stroked.

Strokes that set `miterLimit` explicitly are unaffected. Anything relying on
the old default can set `miterLimit: 10`.
