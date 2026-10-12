---
'@weasel-js/core': patch
---

A canvas hears of a scene-layer change from its adapter instead of polling for one at paint. `LayerEnumerableAdapter` gains an optional `subscribeLayers(listener)`, which the adapter `<SceneCanvas>` builds implements, and a layer added, removed, or reordered now paints on the next frame; the poll skipped one. This adds API. A hand-written adapter that implements `getLayers` and changes the list after mount has to implement `subscribeLayers` too, or the canvas keeps the list it mounted with. That trade was made on an agent's judgment.
