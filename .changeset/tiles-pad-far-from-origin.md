---
'@weasel-js/tiles': patch
---

`dirty` marks a tile touching an edit's edge stale at the deepest levels too, where a texel's pad is finer than a world coordinate can hold.

<!-- entry: fix -->
