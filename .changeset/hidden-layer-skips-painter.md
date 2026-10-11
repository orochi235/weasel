---
'@weasel-js/core': patch
---

The scene walk called `drawOne` for every node on a hidden layer and then discarded the result. `buildSceneTree` no longer calls the painter for those nodes; their clips still apply to children on visible layers.
