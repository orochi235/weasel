---
'@weasel-js/guides': patch
---

`sceneGridRegions` takes time linear in the containers running their own grid, where many sibling containers made it quadratic.

<!-- entry: perf -->
