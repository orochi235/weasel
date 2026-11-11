---
"@weasel-js/p-touch": patch
---

`writeLbx` writes no object whose position, points, or pen width is not finite, and rasterizes that command instead.

`lbxObjects` placed at such a position are skipped with a reason.

<!-- entry: fix data -->
