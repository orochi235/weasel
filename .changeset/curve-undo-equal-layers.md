---
'@weasel-js/ui': patch
---

An undo in a `LayeredCurveEditor` reports no edit to a layer it leaves equal, though its state is rebuilt each render.

<!-- entry: fix -->
