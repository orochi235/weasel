---
'@weasel-js/theme': patch
---

`toDTCG` writes a theme's own ramps and tint list, under `$extensions["com.weasel.ramps"]` and `$extensions["com.weasel.tints"]`, and `loadDTCG` reads them back. Before, both were dropped on the way out: a theme loaded from its own export lost its ramps, so `colorAt` over a ramp only it declared threw, and its tints fell back to the parent's.
