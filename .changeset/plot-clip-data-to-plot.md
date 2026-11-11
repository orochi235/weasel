---
"@weasel-js/plot": patch
---

An xychart's and a radar's data are cut to the plot area, so nothing past it is drawn on the canvas or in any export.

A bar past a fixed end of the value axis is cut at the plot's edge, with its drag handle on that cut end. A line is clipped to the plot, a radar's outline and fill to its rim, and a point whose center falls outside is not drawn.

<!-- entry: fix visual -->
