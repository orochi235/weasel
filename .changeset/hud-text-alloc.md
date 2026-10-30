---
'@weasel-js/text': patch
---

Text laid out and painted fresh every frame, such as a HUD readout, allocates 19–28% less in the HUD benchmark. The layout and paint caches share one entry per runs array, a recycled layout hands its result object and `bounds` on to the next layout that takes its arrays, and laying out no longer boxes the numbers it passes between its own steps. A `cachedLayoutRuns` result read with `'read'` may now be the same object as a later, different layout's, as its line boxes already could; one kept with `'keep'` is unaffected.
