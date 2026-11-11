---
"@weasel-js/plot": patch
---

`formatTick` writes a value or step finer than 1e-100 with an exponent, as `formatNumber` already did, so the column `spacedTicks` returns for a domain among the subnormals reads `0`, `2e-323` rather than two zeros.
