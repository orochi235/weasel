---
'@weasel-js/core': patch
---

`<SceneCanvas>` warns in development when it is handed props another prop makes it ignore: `defaultTools`, `defaultActiveTool`, `ambient` or `selectTool.pickBest` beside a `ToolsApi` in `tools`, and `geometry.picking` beside `geometry.pickEvery`.

<!-- entry: fix -->
