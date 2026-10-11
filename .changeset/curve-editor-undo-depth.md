---
'@weasel-js/ui': patch
---

`LayeredCurveEditor` and `CurveEditor`: the built-in undo keeps the last 100 steps. It held a snapshot of every layer for every edit made while the editor was mounted.
