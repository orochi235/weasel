---
"@weasel-js/core": patch
---

`<SceneCanvas layers>` now types its scene slot as partial, matching what it already did at runtime: a slot such as `{ scene: { cull: true } }` keeps the default `drawOne` and no longer needs one restated to typecheck. The prop's type is exported as `SceneCanvasLayers`. `LayersMap` takes an optional third parameter for the scene slot's type; it defaults to the full `SceneSlotConfig`, so existing uses are unchanged.
