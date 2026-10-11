---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`DepSchema` declares the `activeTool` dep in `@weasel-js/routing` itself, where its type and the `tool.offhand` action that requires it live, so `ctx.deps.activeTool` is typed without core's augmentation. Nothing changes for a consumer naming `'@weasel-js/core'`.
