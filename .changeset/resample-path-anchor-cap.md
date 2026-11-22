---
'@weasel-js/geom': patch
---

`resamplePath` places at most 10,000 anchors, so a `spacing` near 0 or a huge `count` returns instead of hanging.

<!-- entry: fix -->
