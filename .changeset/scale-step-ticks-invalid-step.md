---
'@weasel-js/scale': patch
---

`stepTicks` throws a `RangeError` for a step that is not a positive finite number, such as a negative one, rather than returning no ticks.

<!-- entry: fix -->
