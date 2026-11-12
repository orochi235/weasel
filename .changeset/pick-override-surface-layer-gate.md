---
"@weasel-js/core": patch
---

A click through a `geometry.pickEvery` override, such as a 3D host's ray pick, passes over a layer `layerVisibility` hides.

The override is handed the surface's own layer gate, as a view's already was and as the marquee always was.

<!-- entry: fix -->
