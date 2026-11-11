---
"@weasel-js/cursor": patch
---

A cursor turned by an angle near the double range no longer bakes `NaN` into its image and hotspot. `bakeCursor` and `cursorFor` draw a size that is not a finite positive number at the default 24, as a spec's size resolves, rather than as an empty or negative image. `brushRing` draws a brush too small to round to a pixel at one pixel, where it fell back to the default 24. `cursorWorldSize` stays finite where the ring's size on screen is.
