---
'@weasel-js/svg': patch
---

`parseSvg` honored `clip-path` only as an attribute on `<g>`. It is now read through the cascade, so `style="clip-path:url(#c)"` and a stylesheet rule clip a group too, and a `clip-path` on a shape, `<image>`, or `<text>`, which the node model cannot hold, warns instead of being dropped silently.
