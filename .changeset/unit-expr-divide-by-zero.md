---
"@weasel-js/quantity": patch
---

`resolveUnitExpr` throws on a division by zero and on a result past a number's range, rather than returning `Infinity` or `NaN`.

<!-- entry: fix -->
