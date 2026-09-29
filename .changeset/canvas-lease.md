---
"@weasel-js/core": patch
---

`<Canvas paintInto>` now follows its target: when `paintInto.canvas` moves to another element, the next frame paints there and the old element's renderer, with every GL program, buffer and texture it made, is freed. Before, every later frame went to the first element it painted and that renderer lived until unmount; a change of `paintInto.x`/`y` alone also did not repaint. `<Canvas>` now holds its renderer through the same lease as `<SceneViewCanvas>`, `<MinimapCanvas>` and `<DrawCanvas>`, so every surface in core has one renderer setup and teardown. No public API changed.
