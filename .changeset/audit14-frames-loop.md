---
'@weasel-js/ui-logic': patch
---

`frames` throws a `RangeError` for a `loop` count that is NaN or negative. NaN walked forever with `passes: 'all'`, and a negative count could end on a frame before the run began.
