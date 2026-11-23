---
'@weasel-js/tiles': patch
---

A tile pyramid short of bytes no longer steps past its scheme's top level to one with no tiles, which had left the screen blank; it keeps the coarsest level that has tiles.

<!-- entry: fix visual -->
