---
'@weasel-js/text': patch
---

Painting text builds no key strings for text that is new every frame. `cachedPaintRuns` builds a painting's key only once a second runs array asks the same layout for one, and keeps a runs array's own painting without a `WeakMap` per array. `paintRuns` groups glyphs by comparing their face, tier, page and run, and builds a run's paint string only to compare glyphs of different runs. What is painted, and how it is grouped and shared, is unchanged.
