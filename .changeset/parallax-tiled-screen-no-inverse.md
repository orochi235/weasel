---
"@weasel-js/parallax": patch
---

A `space: 'screen'` source inside `createTiledLayer` draws nothing under a view zoomed to 0 or a denormal on an axis.

<!-- entry: rank=-5 fix -->
