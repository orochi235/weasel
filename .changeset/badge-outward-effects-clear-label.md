---
'@weasel-js/ui': patch
---

A `Badge` on a fitted base (`puzzle`, `quatrefoil`, `octant-spline`, `octant-bspline`) keeps its label clear of `scallops` and `spikes`. Those effects move the outline outward, and where the base has a notch narrower than the distance they move it, the far side of the notch landed on the label. The base now pads for any point an effect or `bloat` moves onto the label, whichever way it moved.
