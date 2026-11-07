---
'@weasel-js/kernel3d': patch
---

`dollyToward` on a camera at distance 0 dollies it out about its target. It used to set the target to `NaN`, which no later gesture could recover from.
