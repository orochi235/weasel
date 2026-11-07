---
'@weasel-js/svg': patch
---

`parseSvg` clips a `<path>`, shape, `<text>` or `<image>` that carries `clip-path`, by wrapping it in a `<g>` node holding the clip, read in the leaf's own user space (its `transform` included). It used to draw such a leaf unclipped and warn. A `clip-path` on a nested `<svg>` still warns.
