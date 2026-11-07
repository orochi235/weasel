---
'@weasel-js/core': patch
'@weasel-js/parallax': patch
---

A parallax plane under a flipped camera axis (a y-up view) stays flipped. `deriveParallaxView` used to interpolate a plane's scale from 1 toward the camera's signed scale, so with `zoom: 0` a y-up camera's planes drew y-down, and with `zoom: 0.5` a camera at scale -1 gave its planes a scale of 0. The plane now tracks the magnitude of the camera's zoom and keeps its sign, and a `zoom` above 1 on a zoomed-out camera floors at `ZOOM_FLOOR` rather than crossing zero.
