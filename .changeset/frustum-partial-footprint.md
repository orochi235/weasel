---
'@weasel-js/kernel3d': patch
---

A kernel3d view's aim drawn into a 2D view now outlines the part of the plane z = 0 its frustum actually takes in, cut off at the camera's far plane. A camera tilted so the horizon is in view used to outline nothing, because one of its corner rays missed the plane; it now outlines the ground it sees. A camera whose corner rays all meet the plane within its far distance outlines the same four points as before.
