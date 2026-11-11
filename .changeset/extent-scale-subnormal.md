---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

A box remap from a box of subnormal width or height keeps that axis's scale, as one from a box of no extent
does, rather than scaling by an infinite factor and writing `NaN` and `Infinity`. The rule is geom's new
`extentScale`, which `boxToBox`, core's rect pose descriptor, and `remapRotatedLeaf` all read.
