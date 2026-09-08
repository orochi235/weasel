---
'@weasel-js/svg': patch
---

An unpacked `<text>` keeps its color.

`svgNodesToKitDrafts` built a text leaf as `{ text, style }` and left `fill`,
`stroke` and `runs` on the floor, so importing an SVG as native scene nodes
dropped every glyph to the painter's default black and flattened per-`<tspan>`
styling the parser had already read. All three now reach the leaf.

A `userSpaceOnUse` gradient on a text node — or on one of its runs — is rebased
onto the leaf's own box, the way a path's already was, so it survives the
fit-clamp and the drop-point placement. A run carrying an absolute `fontSize`
takes the fit-clamp scale alongside the node's.
