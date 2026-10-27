---
'@weasel-js/geom': patch
'@weasel-js/text': patch
'@weasel-js/core': patch
---

`@weasel-js/geom` adds `joinPaths(parts)`, which joins polygon paths into one `'nonzero'` compound path measured from the first part's origin, re-measuring any part that has another. `textToPath`, `textToPathsByPaint` and `textClusters` join their glyphs through it, so text set far from 0 keeps an origin instead of dropping it, and a decoration rule there is measured from one too. A derived path made of several parts (a blend, a repeat) joins through it as well.
