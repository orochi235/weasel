---
'@weasel-js/ui': patch
---

An undo or redo in a `LayeredCurveEditor` reports no edit to a layer whose state it leaves equal, even when the consumer builds that state afresh each render.

<!-- entry: fix -->
