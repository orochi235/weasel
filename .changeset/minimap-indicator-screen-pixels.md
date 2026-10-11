---
'@weasel-js/core': patch
---

`<MinimapCanvas>` draws its visible-window indicator at the `indicatorStyle` width and dash in CSS pixels, as documented. They were applied in world units inside the fit transform, so a 4000-unit scene in a 200px minimap got a line about 0.05px wide, effectively invisible, and a scene smaller than the minimap got a fat one. `computeIndicatorCommand` takes the minimap's view as an optional fourth argument to do the conversion.
