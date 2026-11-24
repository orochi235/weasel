---
'@weasel-js/core': patch
---

A canvas registers an action rebuilt under the same id, such as a surface contribution's action remade for a new scene, in place of the one before it, so a drag acts on the current scene.

<!-- entry: fix -->
