---
'@weasel-js/core': patch
---

`viewport.zoom` lists Zoom In, Zoom Out and Reset Zoom as variants, so a menu or an `actions` group shows three entries, each with its key, where it showed one "Zoom" that zoomed in. Not purely additive: a bar `action` leaf naming bare `viewport.zoom` now draws a dead button, and has to name `viewport.zoom:in`, `viewport.zoom:out` or `viewport.zoom:reset`.
