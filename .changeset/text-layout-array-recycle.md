---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
'@weasel-js/hud': patch
'@weasel-js/core': patch
---

Text rewritten every frame stops allocating its layout and quad arrays. Adds API: `dropRuns(runs)` tells the text caches a runs array will not be laid out again, and `cachedLayoutRuns` and `cachedPaintRuns` take a last argument, `'keep'` (the default) or `'read'`, for a caller that is done with the result before its next call. A layout that no runs array files, that the structural list has let go, and that every caller only read gives its arrays to the next layout and painting of the same size. The renderer reads; a HUD text widget drops the runs it replaces. Results are unchanged.
