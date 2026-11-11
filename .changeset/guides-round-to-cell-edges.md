---
"@weasel-js/guides": patch
---

`roundToCell` returns a value it cannot round unchanged.

That is a value that is not finite, one whose multiple overflows, or any value on a cell size that is not a positive finite number, as a grid pitch must be.

<!-- entry: rank=-5 fix -->
