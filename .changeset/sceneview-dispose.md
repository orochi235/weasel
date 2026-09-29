---
"@weasel-js/core": patch
---

`<SceneViewCanvas>` and `<MinimapCanvas>` now free their renderer and every GL program, buffer and texture it made when they unmount; before, each mount leaked them. All three detached canvas surfaces (those two and `<DrawCanvas>`) now share one renderer lifetime, so their setup and teardown cannot drift apart. Additive: `releaseCanvasRenderer(canvas)` is exported, freeing the renderer `renderSceneToCanvas` created for a canvas.
