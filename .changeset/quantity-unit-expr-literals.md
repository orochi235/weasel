---
"@weasel-js/quantity": patch
---

`parseUnitExpr` throws on a compound value with a term that carries no unit, such as `2 3` or `1ft 2`, as `parseNumber` refuses `5ft 3`.

A compound of measures such as `5ft 3in` reads as before.

<!-- entry: fix -->
