---
'@weasel-js/core': patch
---

A `<CanvasView>` takes presses on every registered or slot layer it paints, even one the canvas's own `layerVisibility` or `layerOrder` hides.

<!-- entry: fix -->
