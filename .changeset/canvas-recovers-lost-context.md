---
'@weasel-js/core': patch
---

A canvas now comes back by itself after its WebGL context is lost and restored. `<Canvas paintInto>` panes sharing one buffer never asked the browser to restore the context, so every pane stayed blank until a reload; `WeaselRenderer` now listens for loss on the context's own canvas whether or not it sizes it. `<SceneCanvas>`, `<DrawCanvas>`, `<SceneViewCanvas>`, and `<MinimapCanvas>` also repaint as soon as the context returns, where a static one used to stay blank until something else asked for a frame. While the context is lost a paint no longer counts as landed, so `subscribeFrame` subscribers and `getPaintedVersion()` do not report a frame that drew nothing.
