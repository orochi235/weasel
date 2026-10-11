---
'@weasel-js/ui': patch
---

Merging a `BandEditor` band with `x` or `Delete` left keyboard focus on nothing, or on the band to the right of the selection. Focus now moves to the band that absorbed the merged one, which is also the one selected.
