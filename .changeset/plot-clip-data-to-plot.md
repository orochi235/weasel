---
"@weasel-js/plot": patch
---

An xychart's and a radar's data are cut to the plot area when they are compiled, so nothing past it is drawn by the canvas or any export. A bar past a fixed end of the value axis is cut at the plot's edge, and its drag handle sits on that cut end. A line is clipped to the plot, a radar's outline and fill to its rim, and a point whose center falls outside is not drawn. A value of any size stays finite. Before, a value past a fixed end was drawn as far past the plot as it reached, and a large enough one overflowed what a path holds.
