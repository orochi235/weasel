---
'@weasel-js/path-tools': patch
---

Bending a segment in path edit bends its images under the `pathSymmetry` dep too, so a symmetric path stays symmetric, as it does under an anchor or handle drag.

<!-- entry: fix -->
