---
'@weasel-js/animator': patch
---

`setJointWeights` gives a joint the share asked for where another joint weighs a negative number or NaN. It zeroes those weights.

<!-- entry: fix -->
