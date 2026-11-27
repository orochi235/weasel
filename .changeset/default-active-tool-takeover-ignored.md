---
"@weasel-js/core": patch
---

`defaultActiveTool` is ignored on a `<SceneCanvas>` handed a whole `ToolsApi`, rather than throwing on an id the canvas's own tools lack.

<!-- entry: fix -->
