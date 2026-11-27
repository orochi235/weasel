---
'@weasel-js/core': patch
---

A parallax plane with `zoom` above 1 keeps zooming out with the camera instead of collapsing to the zoom floor. A plane's `zoom` is now an exponent on the camera's zoom.

A plane with `zoom: 0.5` under a camera at 4 now draws at 2 (it drew at 2.5), and one with `zoom: 2` under a camera at 0.5 draws at 0.25 (it drew at the floor).

<!-- entry: fix behavior visual -->
