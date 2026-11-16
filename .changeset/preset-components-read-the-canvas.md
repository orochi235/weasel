---
'@weasel-js/core': minor
---

A preset's components get `canvas`, the context its `build` gets, which also reads the insert factories now.

`PresetBuildContext` adds `insertNodeFactories()`, and the pickers add `pick.reachable(id)`, `pick.targetOf(id)` and `pick.alphaOf()`, read live: what a component publishing a dep over the canvas's scene and pickers needs.

<!-- entry: api -->
