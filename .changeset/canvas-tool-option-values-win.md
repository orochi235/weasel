---
'@weasel-js/routing': patch
---

`<SceneCanvas toolOptionValues>` stays the store a canvas's tools read after a child publishing its own with `useToolOptionValues` remounts.

The child's store is used only when the canvas is given none.

<!-- entry: fix -->
