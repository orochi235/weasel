---
'@weasel-js/ui': patch
---

`useSceneLayerList`: `adapter` is now optional. Without one, a reorder is applied to the scene as a single history entry, so a caller no longer builds an adapter only to hand it over.
