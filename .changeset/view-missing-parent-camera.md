---
'@weasel-js/core': patch
---

A `<CanvasView>` whose `parent` is not mounted derives its `view` or `aim` thunk against its empty rect, not the whole surface.

<!-- entry: fix -->
