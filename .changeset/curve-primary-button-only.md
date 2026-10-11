---
'@weasel-js/ui': patch
---

A right or middle click on a `CurveEditor` curve, or on empty plot with `addPointMode="click-empty"`, inserted a point, and a middle press dragged an anchor. `createFunctionLayer` now acts on the primary button only; a right-click on an anchor still deletes it.
