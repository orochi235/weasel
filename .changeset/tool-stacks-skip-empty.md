---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

`toolStacksOf` leaves out a stacked set that names no tool, so a palette given a stack cut down to nothing by `withoutTools` (path-tools' `WARP_TOOLS` less all three warps, say) no longer draws an empty stack button.
