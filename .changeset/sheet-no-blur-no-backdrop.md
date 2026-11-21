---
'@weasel-js/ui': patch
---

A `sheet` frame with no blur set has no backdrop filter, so a `position: fixed` element inside it is placed against the viewport again.

<!-- entry: fix -->
