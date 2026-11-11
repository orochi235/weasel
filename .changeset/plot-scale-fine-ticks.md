---
"@weasel-js/plot": patch
---

Scale ticks finer than 1e-100 apart keep their values and are labeled with an exponent (`1e-300`) instead of all reading `0`.

A span among the subnormals is ticked at multiples of itself, with no tick outside it.

<!-- entry: rank=-5 fix -->
