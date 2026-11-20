---
'@weasel-js/core': patch
---

A `<SceneCanvas layers>` slot field set to `undefined` keeps the kit default.

`scene.drawOne: undefined` still paints, and `selectionOverlay.handles: undefined` keeps the default handle size.

<!-- entry: fix -->
