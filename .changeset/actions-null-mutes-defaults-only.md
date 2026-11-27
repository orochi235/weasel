---
'@weasel-js/core': patch
---

`<SceneCanvas actions={null}>` mutes the kit's standard and viewport actions however late they register, and leaves every other action live whatever order it registered in.

<!-- entry: fix -->
