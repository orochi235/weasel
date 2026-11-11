---
'@weasel-js/core': patch
---

`zoomAt` no longer turns an axis over or leaves a view that is not finite. A negative or `NaN` factor zooms
nothing (a negative one flipped the axis, and `NaN` dropped the zoom to `ZOOM_FLOOR`, below the clamp); a factor
of 0 on a flipped axis keeps it flipped; and an anchor that is not finite, or whose world point overflows, zooms
about the canvas corner instead of writing `NaN` into the view.
