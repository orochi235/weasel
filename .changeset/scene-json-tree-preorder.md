---
'@weasel-js/core': patch
---

`scene.toJSON()` writes `nodes` in tree preorder instead of layer-major order, so siblings on different layers come back from `loadState` / `sceneFromJSON` in the order they were saved. This changes the documented order of `nodes`: parents still come before children, but a reader painting straight from `nodes` now has to take paint order from the layers.
