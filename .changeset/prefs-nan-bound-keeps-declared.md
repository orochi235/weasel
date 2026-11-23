---
'@weasel-js/prefs-schema': patch
---

A number leaf's `minAt` or `maxAt` that reads as `NaN` leaves the declared `min` or `max` in place, so the value is still clamped.

<!-- entry: fix -->
