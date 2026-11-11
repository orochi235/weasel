---
'@weasel-js/core': patch
---

A click-to-place insert paints the shape with the tool's fill and stroke options, as a drag insert does, rather than the next palette color.

`placeAction` hands its style params to the `insert` dep as `extras.style`.

<!-- entry: fix -->
