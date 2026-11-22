---
'@weasel-js/path-tools': patch
---

Join Paths drops per-anchor colors the other path cannot match, instead of painting its anchors transparent black.

A path whose fill or stroke is a gradient, for example, gives no color to fill those anchors with.

<!-- entry: fix visual -->
