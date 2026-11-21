---
'@weasel-js/ui-input': patch
---

`framesSweep` counts a `loop` below 1 as one whole pass, as the clock plays it.

A `loop` of 0, 0.5 or a negative number now walks the frames the clock shows.

<!-- entry: fix -->
