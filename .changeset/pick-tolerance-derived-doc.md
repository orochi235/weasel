---
'@weasel-js/editing': patch
---

`useSelectTool`'s `pickTolerance` docs say the default `'aabb'` picker reads it around a derived route's box.

A straight route's box has no area, so it is hit only with `pickTolerance` set.

<!-- entry: rank=-5 fix -->
