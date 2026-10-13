---
'@weasel-js/routing': patch
---

Breaking: `ToolBounds` is gone from `@weasel-js/routing`. It was an alias of `Bounds` kept for `Tool.previewBounds`, which was removed earlier; import `Bounds` instead.
