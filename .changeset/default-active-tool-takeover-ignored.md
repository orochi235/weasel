---
"@weasel-js/core": patch
---

`defaultActiveTool` on a `<SceneCanvas>` handed a whole `ToolsApi` is ignored, as its warning says, rather than throwing when the canvas's own tools lack that id.

<!-- entry: fix -->
