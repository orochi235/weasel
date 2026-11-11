---
"@weasel-js/plot": patch
---

`formatNumber` and a linear, log, pow or warp scale's `format` write a small negative that rounds to zero as `0`, not `-0`.

<!-- entry: fix -->
