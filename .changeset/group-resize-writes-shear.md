---
'@weasel-js/core': patch
---

Resizing several nodes at once keeps a turned or skewed one's shape. A non-uniform resize makes a parallelogram of a turned box, and `remapRotatedLeaf` now writes that to the leaf's `pose.transform` where it used to drop it; it also reads a `transform` the leaf already carries, and a skewed leaf with no rotation goes through it too. Breaking for a caller that relied on the result never carrying a `transform`: a turned leaf resized unevenly now has one. A uniform resize, an upright plain leaf, and a leaf turned by a quarter turn still get none.
