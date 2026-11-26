---
'@weasel-js/cursor': patch
---

The cursor fit guards read an arc written with a negative radius at its size, as SVG draws it, not as elliptical.

<!-- entry: fix -->
