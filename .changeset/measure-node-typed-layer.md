---
'@weasel-js/core': patch
---

`measureNode` goes in a typed scene's `initial` list or `add` without a cast.

It returns a node typed with the layer it was given and a `RectPose`.

<!-- entry: fix -->
