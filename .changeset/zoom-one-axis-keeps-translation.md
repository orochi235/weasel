---
"@weasel-js/core": patch
---

`zoomAt` leaves an axis whose scale it does not change exactly where it was. A zoom on one axis (`axisZoomFactor`) used to round the other axis's translation by a fraction of a pixel on every call, so repeated one-axis zooms drifted the view sideways.
