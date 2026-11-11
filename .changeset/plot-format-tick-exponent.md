---
"@weasel-js/plot": patch
---

`formatTick` writes a value or step finer than 1e-100 with an exponent, as `formatNumber` does, so subnormal ticks no longer all read `0`.

<!-- entry: rank=-5 fix -->
