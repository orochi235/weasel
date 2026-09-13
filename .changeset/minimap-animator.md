---
'@weasel-js/core': patch
---

`<MinimapCanvas>` takes an `animator` prop and forwards it to its `<SceneViewCanvas>`, so the minimap repaints on the animator's ticks and paints its vertex-color overrides. Pass the main canvas's animator and the minimap shows the same animated colors instead of each node's stored ones.
