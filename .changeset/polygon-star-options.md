---
'@weasel-js/core': patch
---

`usePolygonTool` and `useStarTool` ignored their `label` option and always showed "Polygon" and "Star". `useStarTool` also kept the `innerRatio` it was first rendered with, so a ratio driven by a slider never changed the stars drawn. Both options now take effect.
