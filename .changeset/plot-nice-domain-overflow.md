---
'@weasel-js/plot': patch
---

`niceDomain`, and a `linearScale` with `nice`, keep a domain near `Number.MAX_VALUE` finite. A span too fine for its step, such as `[0, 5e-324]`, is kept as given.

<!-- entry: rank=-5 fix -->
