---
'@weasel-js/core': patch
---

A `<CanvasView>` whose `id` another view on the same canvas already holds is skipped with a console error, as a duplicate `<ViewMarker>` is.

<!-- entry: fix -->
