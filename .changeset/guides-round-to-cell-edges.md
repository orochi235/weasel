---
"@weasel-js/guides": patch
---

`roundToCell` returns a value it cannot round as it was: one that is not finite (`NaN` came back 0), one whose multiple overflows (the largest double came back `Infinity`), or any value on a cell size that is not a positive finite number, as a grid pitch must be (a zero or `NaN` cell sent every value to 0, and a negative one rounded on its size).
