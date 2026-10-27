---
'@weasel-js/renderer': patch
---

A retained layer holding text gets a surface the size of its text rather than the whole drawing buffer. Text is bounded by its laid-out glyphs, each grown by a margin for ink past its advance cell (half an em beside it, an em and a half above its baseline, an em below) and by its run's outline stroke. The same bound now also culls a group with `effects` that holds text, and sizes the raster a PDF export draws such a group into.
