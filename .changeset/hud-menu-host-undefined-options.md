---
'@weasel-js/hud': patch
---

`attachMenuHost` uses the hud's `toCanvas` and `canvasSize` when either option is passed as `undefined`, rather than throwing when the menu opens.

<!-- entry: fix -->
