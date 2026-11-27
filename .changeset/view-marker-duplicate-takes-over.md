---
'@weasel-js/core': patch
---

A `<ViewMarker>` skipped because another marker on the surface holds its id now takes over when that marker unmounts, as a duplicate `<CanvasView>` does.

<!-- entry: fix -->
