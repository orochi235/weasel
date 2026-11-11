---
"@weasel-js/parallax": patch
---

A `space: 'screen'` source inside `createTiledLayer` draws nothing under a view zoomed to 0 or a denormal on an axis, which has no finite inverse to hand it. It was drawn through a transform holding `Infinity`.
