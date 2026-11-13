---
'@weasel-js/labkit': minor
---

A trial's tool rail shows the key a `TrialSceneCanvas` binds each of its tools to, a rebound one included.

That key replaces the `TrialTool.shortcut` the tool declares. An instrument with input of its own reports its keys through `RenderContext.trial.setToolShortcuts`; a tool it does not name keeps its declared `shortcut`.

<!-- entry: api fix -->
