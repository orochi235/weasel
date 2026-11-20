---
'@weasel-js/kernel3d': patch
---

A two-finger pinch in a 3D `<CanvasView>` dollies about the point between the fingers when the camera dep has an `origin`.

`Camera3dDep.origin` now converts only a wheel's anchor; a pinch's centroid arrives view-local and does not read it.

<!-- entry: fix behavior -->
