---
'@weasel-js/core': minor
---

`buildSceneViewCommands` takes the density its commands will paint at as a last argument, which painters read as `NodePaintCtx.pixelScale`.

It defaults to `cull`'s density, then to `window.devicePixelRatio`. Every painter `drawOne` reaches through the scene walk now receives a `pixelScale` in its context.

<!-- entry: api -->
