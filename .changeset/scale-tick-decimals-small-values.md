---
'@weasel-js/scale': patch
---

`tickDecimals` counts a small tick's places to its own size, so ticks like `1e-10, 2e-10` no longer all label "0".

<!-- entry: fix -->
