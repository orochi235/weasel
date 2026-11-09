---
"@weasel-js/plot": patch
---

`formatNumber`, and the `format` of a linear, log, pow, or warp scale, write a small negative value that rounds to zero on its step as `0` rather than `-0`, as `formatTick` already did.
