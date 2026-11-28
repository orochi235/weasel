---
'@weasel-js/scale': patch
---

Scales invert positions on a range wider than the largest double to the right value. Linear, power, time, and log scales over `[-Number.MAX_VALUE, Number.MAX_VALUE]` gave the domain's start or `NaN`.

<!-- entry: fix -->
