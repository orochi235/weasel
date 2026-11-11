---
"@weasel-js/cursor": patch
---

A baked cursor draws at the default size 24 when its size is not a finite positive number. `bakeCursor` and `cursorFor` also keep `NaN` out of the image and hotspot of a cursor turned by an angle near the double range, and `cursorWorldSize` stays finite wherever the ring's size on screen is.

<!-- entry: rank=-5 fix -->
