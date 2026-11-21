---
'@weasel-js/ui': patch
---

A `quatrefoil` badge's `samples` runs from 24 to 1024, so an infinite or huge count no longer hangs the page.

A `NaN` count draws 24 samples.

<!-- entry: fix -->
