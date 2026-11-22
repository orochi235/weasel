---
'@weasel-js/geom': patch
---

`ArapSolveOptions.iterations: 0` is documented as skipping the local/global rounds only. The injective pass still runs unless `injectiveIterations` is 0 too.

<!-- entry: rank=-1 fix -->
