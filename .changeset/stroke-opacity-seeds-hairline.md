---
'@weasel-js/editing': patch
---

`setStrokeOpacity` on a stroke with neither a paint nor a width gives it a 1-unit width, as `setStroke` does, so the stroke it paints shows.

<!-- entry: fix -->
