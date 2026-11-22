---
'@weasel-js/core': patch
---

Escape and tool keys go on to other bindings on a surface with no `activeTool` dep. `tool.resetToDefault` and `tool.activate` no longer take them and do nothing.

<!-- entry: fix -->
