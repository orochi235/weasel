---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Cap, join and align are chosen by glyph, and the stroke block drops its labels

Nine option glyphs and four category glyphs join the icon set. The option
glyphs are filled silhouettes — the glyph is the ink, so a choice reads as a
shape rather than as a diagram of one. `align` is a circle zoomed until the
ink band's far edge leaves the box: `inner` closes into a disc, `outer` into
the box's complement of it, and `center` is the annulus straddling the path,
so the three are one band at three offsets. The categories are the bare path
each row treats, drawn in the outlined register.

A schema carries a glyph *id*, not a component: `ToolPrefEnum`'s options gain
`icon`, and every leaf gains one for rows whose own label is spent on a
`pair`. Core ships no icon set and cannot depend on one, so the field is a
plain string; weasel-ui resolves it against `ICON_PATHS` and falls back to
`short` where it names no glyph.

`SelectionPanel` now honours `block` inside an object leaf, not only at the
section level. A row whose fields are all `block` drops the 64px label column
and spans the block. The default stroke schema uses both: paint and width
share one label-less row, and cap/join/align share the next.

`align`'s options run inner, center, outer — the order the ink moves outward.
