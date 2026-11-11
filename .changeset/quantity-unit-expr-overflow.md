---
"@weasel-js/quantity": patch
---

`parseUnitExpr` throws on a literal past the range of a number instead of reading it as `Infinity`.

<!-- entry: rank=-5 fix -->
