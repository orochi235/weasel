---
'@weasel-js/ui': patch
---

A `SwatchGrid` or `SwatchStrip` inside a curved `Along` reads a `columns` below 1 or with a fraction as the flat grid does, rounded down to a whole number of at least 1, instead of throwing.

<!-- entry: fix -->
