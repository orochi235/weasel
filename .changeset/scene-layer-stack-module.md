---
'@weasel-js/core': patch
---

Internal: The scene's layer stack (the layer records' setup, the id-to-index map, and the rule tying a node's layer to its parent's) moves out of scene.ts into layerStack.ts. No behavior change.
