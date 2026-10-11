---
'@weasel-js/core': patch
---

The minimap contribution's indicator layer builds its rect with `computeIndicatorCommand`, the builder `<MinimapCanvas>` uses. In a minimap whose view is mirrored on x, the layer used to give the stroke a negative width and dash.
