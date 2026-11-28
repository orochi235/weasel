---
'@weasel-js/scale': patch
---

A tick step with more digits than its magnitude, such as 0.25, places and labels its ticks to every digit it needs: `stepTicks(0, 1, 0.25)` gives 0.75, not 0.8, and `decimalsOf(0.25)` is 2.

<!-- entry: fix -->
