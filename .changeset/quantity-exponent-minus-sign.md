---
"@weasel-js/quantity": patch
---

`parseNumber` and `parseSignedNumber` read a minus sign (U+2212) in the exponent, so `−1e−3` is −0.001 rather than `NaN`.

<!-- entry: fix -->
