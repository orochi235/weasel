---
'@weasel-js/core': patch
---

`<SceneCanvas>` warns in development when it is handed a prop another prop makes it ignore.

That is `defaultTools`, `defaultActiveTool`, `ambient` or `selectTool.pickBest` beside a `ToolsApi` in `tools`, and `geometry.picking` beside `geometry.pickEvery`.

<!-- entry: fix -->
