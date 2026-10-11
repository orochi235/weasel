---
'@weasel-js/core': patch
---

`composeAffordanceLayer`: the bounds reported for a ring (`annulus`) region on a rotated target were too small, by up to 29% for a circle at 45°. That is the box a `custom` paint receives as `CustomPaintContext.world` and the box the debug overlay draws for the rotate ring, which was also turned a second time. Both are now the ring's real bounds.
