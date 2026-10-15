---
"@weasel-js/core": patch
---

A double-click on a path with several nodes selected now opens the path under the pointer for anchor editing. Before, `enterPathEdit` opened the first editable path in the selection, which need not be the one double-clicked. It still falls back to that path when no editable path is under the pointer. The action now requires the `nodeAtPoint` dep, which `<SceneCanvas>` sources.
