---
'@weasel-js/core': patch
---

A partial `<SceneCanvas actions>` entry stops carrying a sibling canvas's fields once that canvas, sharing its actions registry, unmounts.

<!-- entry: fix -->
