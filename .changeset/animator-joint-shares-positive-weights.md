---
'@weasel-js/animator': patch
---

`jointShares` counts only weights above 0, as the skin applies them, so a negative or `NaN` weight no longer skews the weight brush.

<!-- entry: fix -->
