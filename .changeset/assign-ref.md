---
'@weasel-js/react': patch
'@weasel-js/core': patch
---

`@weasel-js/react` exports `assignRef(ref, value)`, which writes a value into a ref prop whether it is a callback ref or an object ref. `<DrawCanvas>`, `<SceneViewCanvas>`, `<MinimapCanvas>`, `<SceneCanvas>` and `ItemList` forward their refs through it.

A callback ref passed as `<SceneViewCanvas canvasRef>` or `<MinimapCanvas canvasRef>` is now called only when the canvas attaches or detaches, or when the ref itself changes. It used to be called with `null` and then the element again on every render.
