---
'@weasel-js/paint': patch
---

`lerpStroke` keeps a stroke's `vertexWidths` and `vertexColors`, so a tapered stroke stays tapered through a blend.

Two arrays of one length interpolate entry by entry; otherwise the result carries the nearer side's array.

<!-- entry: fix visual -->
