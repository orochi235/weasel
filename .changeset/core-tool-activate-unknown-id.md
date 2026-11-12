---
"@weasel-js/core": patch
---

`trigger('tool.activate', { toolId })` with a tool the canvas lacks is refused, as `setActive` refuses it, instead of leaving no tool active.

<!-- entry: fix -->
