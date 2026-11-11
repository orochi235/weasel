---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

A box remap from a box of subnormal width or height keeps that axis's scale, as one from a box of no extent does.

The rule is geom's new export `extentScale(from, to)`, which `boxToBox`, core's rect pose descriptor, and `remapRotatedLeaf` all read.

<!-- entry: rank=-5 fix api -->
