---
'@weasel-js/svg': patch
---

`SvgGroupNode` carries a `clip` outline. `serializeSvg` writes it as a
`<clipPath>` def plus `clip-path="url(#…)"` on the `<g>`, and `parseSvg` reads
one back, baking it into the same space the group's children land in — SVG
applies a group's `transform` to its clip as well, and parse collapses that
transform onto descendants.

A `<clipPath>` is no longer an unsupported element. One holding several shapes
still is: SVG unions them and a `Path` is a single outline, so it warns and
clips nothing rather than clipping wrongly. So does `clipPathUnits="objectBoundingBox"`.
