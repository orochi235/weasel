---
"@weasel-js/kernel3d": patch
---

`POSE3_COMPOSITION.decompose` reads a frame axis scaled too small to divide by as collapsed, so poses rebased into it stay finite.

<!-- entry: rank=-5 fix -->
