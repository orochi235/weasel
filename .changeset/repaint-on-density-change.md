---
'@weasel-js/core': patch
---

A canvas repaints when `devicePixelRatio` changes. Moving a window to a display of another density, or zooming the page, left a static `<DrawCanvas>`, `<SceneViewCanvas>`, or `<MinimapCanvas>` at its old resolution, and a `<SceneCanvas>` blurry until something else redrew it. A canvas given its own `dpr` is unaffected.
