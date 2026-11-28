---
'@weasel-js/scale': patch
---

`tickDecimals` counts up to 100 places, so explicit ticks finer than 1e-20 keep their digits rather than all labeling as zeros.

<!-- entry: fix -->
