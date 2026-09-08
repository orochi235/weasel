---
'@weasel-js/svg': patch
'@weasel-js/labkit': patch
---

A `{ px }` stroke width survives SVG export as `vector-effect="non-scaling-stroke"`.

`{ px }` means "this thickness once rendered, whatever the view is doing".
Serializing wrote its number as a plain `stroke-width`, which is a world-unit
length — so a hairline exported from a zoomed-out view came back a slab, and a
document had no way to say what the kit's own type says. SVG has the attribute
for exactly this, and it needs no accumulated transform scale to resolve
against.

`SvgStroke.width` is now `number | { px: number }`, matching `Stroke.width`.
Parsing reads `vector-effect="non-scaling-stroke"` off the element rather than
the cascade, because SVG does not inherit it — a `<g>` carrying it does not
hand it to its children.
