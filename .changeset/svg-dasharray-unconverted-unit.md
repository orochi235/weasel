---
'@weasel-js/svg': patch
---

A `stroke-dasharray` length in a unit the SVG reader does not convert (`%`, `vw`) is read as its number with a warning, as `stroke-width` reads it, instead of the whole declaration being dropped.

<!-- entry: fix -->
