---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Every path operation carries `tags` naming the gesture that drives it, so the operations sharing a gesture can be gathered with `actionsTagged` / `taggedActionItems`. Each carries `path` and one of `path-drag`, `path-click`, `path-brush`, `path-box`, or `path-command`, defined once as `PATH_GESTURE_TAGS` and applied with `pathOperationTags(family)` (both new in core). `docs/path-operations.md` lists the operations under each tag. Actions built with `makeHandleCommand` and `joinPathsCommand` now carry `path-command` too. Additive.
