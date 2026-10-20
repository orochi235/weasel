---
'@weasel-js/ui': patch
---

A stacked fraction in `QuantityText` is drawn in the theme's numeric face, as its other numbers are, rather
than the browser's math font, with a small gap set on each side of its bar since only a math font carries one.
The BandEditor ruler's fractions read in the UI's numerals as a result.
