---
"@weasel-js/quantity": patch
---

`parseUnitExpr` throws on a literal past the range of a number, which resolved to `Infinity`, and on a compound value with a term that carries no unit: `2 3` and `1ft 2` read as 5 and 14, and now throw, as `parseNumber` already refuses `5ft 3`. A compound of measures such as `5ft 3in` reads as before.
