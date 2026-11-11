---
"@weasel-js/core": patch
---

`defaultPaintBounds` measures a `{ px }` stroke at the scale the pose's own frame and the view draw it at
together. A node whose `transform` squashed an axis widened its screen-sized stroke past the box the cull read,
so the scene slot could skip a node with ink in view.
