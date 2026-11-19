---
'@weasel-js/core': patch
---

Under `<SceneCanvas routing={[]}>` the `kindOfNode` dep is absent, as documented, rather than a function answering `undefined` for every node.

<!-- entry: fix -->
