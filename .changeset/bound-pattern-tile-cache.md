---
'@weasel-js/core': patch
---

`resolvePatternSpec` keeps the 256 built-in pattern tiles most recently resolved or drawn and frees the rest, bitmap and GL texture both, so scrubbing a pattern's color no longer leaves a texture behind per intermediate color. A draw command still holding an evicted tile's handle rebuilds the tile when it is next drawn. `unregisterTexture(handle)` is new on `@weasel-js/core/renderer`: it drops a texture registered with `registerTexture`, and each renderer deletes its GL copy at the top of its next frame.
