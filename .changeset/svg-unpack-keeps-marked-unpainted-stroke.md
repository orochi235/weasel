---
'@weasel-js/svg': patch
---

Unpacking an SVG keeps the markers of a `stroke="none"` path, on a stroke with no paint, so its arrowheads arrive in the scene.

<!-- entry: fix data -->
