---
'@weasel-js/core': patch
---

`<SceneCanvas>` now paints a scene layer added after mount. The per-layer canvas layers (`scene:<layerId>`) were listed once, when the `layers` prop was first resolved, so nodes on a layer from a later `scene.addLayer()` never appeared, and a removed or reordered layer kept its old slot, unless the host happened to pass a new `layers` object. The canvas now rebuilds them when the scene's layer list changes.
