---
"@weasel-js/core": patch
---

Repeated one-axis zooms (`axisZoomFactor`) no longer drift the view sideways.

`zoomAt` leaves the translation of an axis it does not scale exactly where it was.

<!-- entry: fix -->
