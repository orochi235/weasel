---
'@weasel-js/scale': patch
---

A warped or power scale ticks on whole numbers only when its domain holds at least one whole number per tick.

A log1p scale from 0 to 12 now ticks at 0, 1, 3, 6 and 10, where it ticked at 2.5. A domain too narrow for that, such as 0 to 2, still takes halves.

<!-- entry: behavior -->
