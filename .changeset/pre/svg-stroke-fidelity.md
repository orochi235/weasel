---
'@weasel-js/svg': patch
---

Keep a stroke's dash, cap, join and gradient paint through SVG import

`unpack` lowered every stroke to a color string plus a width, because that was
all `data.stroke` could hold — a gradient stroke became `#888888` with a
warning, and dashes, caps, joins and miter limits were dropped silently. Now
that `data.stroke` is `NodeStroke = string | Stroke`, the whole `SvgStroke`
comes through.

A plain solid stroke still arrives as the color-string pair every consumer
already reads. Anything the pair cannot express — a gradient paint, a dash, a
cap, a join, a miter limit, a `stroke-opacity` — arrives as the object form,
with the paint normalized to the leaf's own box exactly as a gradient fill is,
so a `userSpaceOnUse` gradient survives the fit-clamp and the drop placement.

`strokeDataFromSvg` is exported, so a second importer lowering SVG onto kit
nodes doesn't have to re-derive which form to write.
