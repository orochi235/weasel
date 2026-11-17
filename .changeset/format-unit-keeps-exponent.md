---
'@weasel-js/quantity': patch
---

`formatUnit` writes a value of 1e21 or more with its whole exponent: `1.5e+30mm`, where it wrote `1.5e+3mm`.

<!-- entry: fix -->
