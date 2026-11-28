---
'@weasel-js/core': patch
---

A canvas resized while its paint cannot land yet paints the new size on the next frame instead of staying blank until something else asks for a redraw.

<!-- entry: fix visual -->
