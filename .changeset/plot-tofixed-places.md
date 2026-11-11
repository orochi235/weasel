---
"@weasel-js/plot": patch
---

`formatTick` and `toFixedPlain` hold `decimals` to the 0 to 100 places `toFixed` takes, rather than throwing a `RangeError`.

<!-- entry: rank=-5 fix -->
