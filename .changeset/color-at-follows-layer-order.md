---
'@weasel-js/core': patch
---

`<SceneCanvas>`'s `colorAt` dep samples the scene layers `layerOrder` draws, stacked in its order, and none it leaves out.

<!-- entry: fix -->
