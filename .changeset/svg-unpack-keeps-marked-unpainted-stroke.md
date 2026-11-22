---
'@weasel-js/svg': patch
---

Unpacking an SVG keeps a `stroke="none"` path's `marker-start`, `marker-mid`, and `marker-end` on a stroke with no paint, so its arrowheads arrive in the scene.

<!-- entry: fix data -->
