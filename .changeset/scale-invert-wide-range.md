---
'@weasel-js/scale': patch
---

Linear, power, time, and log scales invert positions on a range wider than the largest double, such as `[-Number.MAX_VALUE, Number.MAX_VALUE]`, to the right value rather than to the domain's start or `NaN`.

<!-- entry: fix -->
