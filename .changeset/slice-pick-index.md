---
'@weasel-js/core': patch
---

The default `slice` dep now reads only the nodes the scene's pick index finds under the cut's bounds, instead of every node in the scene, whenever the index is built. A cut in a scene that just changed still walks every node.
