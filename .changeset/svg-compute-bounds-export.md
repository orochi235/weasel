---
'@weasel-js/svg': minor
---

New `computeBounds(nodes)`: the box an `SvgNode` tree's ink covers, strokes and marker heads included.

It is the `viewBox` `serializeSvg` writes when given none.

Pass it as `viewBox`, `width` and `height` to fit a document to what it draws.

<!-- entry: api -->
