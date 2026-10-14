---
'@weasel-js/renderer': patch
---

A run of batched draws holds fifteen textures where it held seven, so a page mixing more than seven images, font atlases, and gradients no longer breaks the batch at the eighth. The batch shader now samples sixteen texture units, the most WebGL2 guarantees, and reaches a unit in four compares where the old chain took up to seven.
