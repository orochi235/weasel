---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

`strokeHasInk` and `hasStroke` report no ink for a stroke of infinite width, which draws nothing, so Outline Stroke is no longer offered for it.

<!-- entry: fix -->
