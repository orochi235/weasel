---
'@weasel-js/core': patch
---

Dragging a `Path`-posed node with `selectTool.snap` set no longer turns every coordinate to `NaN`. The `snap` behavior read the pose's origin as a rect's `x`/`y` by default, which a `Path` doesn't have. It now defaults to `AUTO_ORIGIN_PROJECTION`, the same projection `gridSnapStrategy` uses, which reads a `Path`'s bounds origin.
