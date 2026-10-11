---
'@weasel-js/core': patch
---

A canvas whose size changed and changed back between two paints no longer shows the scene stretched on a high-density display. React rewrote the `<canvas>` `width` and `height` attributes in CSS pixels, and the renderer skipped its resize because the size matched the last one it painted, leaving an 800px buffer where 1600 were expected at a device pixel ratio of 2. `<SceneCanvas>`, `<DrawCanvas>`, `<SceneViewCanvas>`, and `<MinimapCanvas>` now check the element's real buffer size on every paint.
