---
"@weasel-js/core": patch
---

A node squashed by its `transform` is no longer culled while its `{ px }` stroke is still in view. `defaultPaintBounds` measures such a stroke at the scale the pose's frame and the view draw it at together.

<!-- entry: fix visual -->
