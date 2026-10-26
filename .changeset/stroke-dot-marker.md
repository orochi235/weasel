---
'@weasel-js/stroke': patch
'@weasel-js/paint': patch
---

Add a built-in `dot` stroke marker, centered on its anchor rather than trailing back from it like every other built-in. It is the one to reach for as `markerMid`: a terminator such as `diamond` puts its tip on the interior vertex and its body behind it, which reads as off-center. `KitMarkerKey` gains `'dot'`, and `Stroke.markerMid`'s docs now say where a head's anchor lands.
