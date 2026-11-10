---
"@weasel-js/quantity": patch
---

`resolveUnitExpr` throws on a division by zero (`1/0`, `0/0`) and on a result past the range of a number, rather than returning `Infinity` or `NaN`.
