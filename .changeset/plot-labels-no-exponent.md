---
'@weasel-js/plot': patch
---

`formatNumber`, `formatTick` and every scale label built on them write a value of 1e21 or more in full digits, as they write a smaller one. Such values used to switch to `1e+21`, so a log axis from 1e20 to 1e22 read `100000000000000000000`, `1e+21`, `1e+22`.
