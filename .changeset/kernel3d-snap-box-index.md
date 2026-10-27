---
'@weasel-js/kernel3d': patch
---

`boxSnapSource` and `alignPlaneSource` read the scene's world boxes through an index kept against the scene's version and the world's `bounds`, so a snap during a drag reads only the boxes in reach of its probes instead of boxing every node each frame. They offer the same candidates in the same order as before.
