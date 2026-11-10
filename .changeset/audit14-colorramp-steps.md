---
'@weasel-js/ui': patch
---

`colorRamp` given a fractional step count takes its whole steps and still ends on `to`. `3.5` drew three colors that stopped short of the last one.
