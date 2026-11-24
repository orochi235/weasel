---
'@weasel-js/renderer': patch
---

A tiled layer clears every tile a `source-in`, `destination-in`, `destination-atop`, or `copy` group reaches, not just those its children cover.

`commandsBounds` counts such a group as reaching everywhere inside its own clip.

<!-- entry: fix visual -->
