---
'@weasel-js/quantity': patch
---

A `fraction` counted in a constant reads typed digits too large for a number, such as `1e308π`, as NaN rather than as infinity.

<!-- entry: fix -->
