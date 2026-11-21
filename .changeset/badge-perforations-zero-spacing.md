---
'@weasel-js/ui': patch
---

A Badge `perforations` effect with `holeRadius` and `holeSpacing` both 0 draws its holes 1 CSS px apart, where it had hung the page. A negative `holeRadius` draws no hole instead of an invalid one.

<!-- entry: fix -->
