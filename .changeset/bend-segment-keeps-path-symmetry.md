---
'@weasel-js/path-tools': patch
---

Bending a segment in path edit keeps a symmetric path symmetric.

The segment's images under the `pathSymmetry` dep bend with it, as they do under an anchor or handle drag.

<!-- entry: fix -->
