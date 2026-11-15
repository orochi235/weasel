---
'@weasel-js/core': patch
---

Undo and Redo buttons outside a canvas enable and disable as the history moves, without the page re-rendering on each edit.

`useStandardDeps`, and so `useStandardActions` and `<SceneCanvas>`, now tells the dep registry when the scene, its history, or the selection it publishes changes.

<!-- entry: fix -->
