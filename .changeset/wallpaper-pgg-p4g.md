---
'@weasel-js/symmetry': patch
---

`WALLPAPER_GROUPS` now has all seventeen wallpaper groups: pgg and p4g join it. They use a new optional `SymmetrySpec.glideRows`, which makes a wallpaper's glide mirror every other row rather than every other column; on a lattice whose rows are offset, that puts the glide axes between the rows, which is what those two groups need. A spec without it behaves as before.
