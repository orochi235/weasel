---
'@weasel-js/core': patch
---

`renderSceneToPixels` and `RasterSession.render` take `layers`, naming the scene layers to draw the way a `LayerGroup` names its members: `'scene:<layerId>'` for one, `'scene'` for all. A name that matches none of the scene's layers throws.
