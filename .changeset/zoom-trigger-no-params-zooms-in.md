---
'@weasel-js/core': patch
---

`registry.trigger('viewport.zoom')` with no params zooms in the way Zoom In does. It zooms about the view's center, glides when `animate` is on, and is recorded in the debug log.

<!-- entry: fix -->
