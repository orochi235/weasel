---
'@weasel-js/ui': patch
---

`createSetCurveOp` skipped an edit whose only change was a point's `locked` flag, so locking or unlocking a control point through the op never reached the adapter. The op now applies it.
