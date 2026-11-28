---
'@weasel-js/scale': patch
---

Ticks on a step such as 0.25 land on its grid and label to every digit it needs. `stepTicks(0, 1, 0.25)` gives 0.75, not 0.8, and `decimalsOf(0.25)` is 2.

<!-- entry: fix -->
