---
'@weasel-js/core': patch
---

`WeaselRenderer` resets the color mask, the bound vertex array, and `UNPACK_FLIP_Y_WEBGL` at the start of every frame, alongside the blend, depth, and cull state it already reset. Another renderer drawing on the same context could leave any of them set, which blanked the frame or flipped later texture uploads.
