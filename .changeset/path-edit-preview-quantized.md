---
'@weasel-js/core': minor
---

Path-edit drags preview the path as the scene's output grid stores it, so an edit lands where it showed.

This covers anchor and handle drags, balance grips, Lengthen, corners and the Simplify brush. The `editAnchors` dep gains an optional `quantized(id, stored)`, which `<SceneCanvas>`'s dep answers through the scene's quantize rule; `quantizedShape` is exported for a hand-wired dep.

<!-- entry: fix visual api -->
