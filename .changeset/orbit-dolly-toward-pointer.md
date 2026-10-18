---
"@weasel-js/labkit": patch
"@weasel-js/kernel3d": patch
---

An orbit dollies about the point under the pointer, as a 2D camera zooms about
it. kernel3d's `dollyToward` keeps the point in the target's screen-facing
plane under the pointer still and slides the target toward it, and
`camera.dolly` and `camera.pinchDolly` go through it, anchored at the pointer
and at where the fingers began.

An orbit instrument whose scene fills only part of its DOM names that pane with
`useTrialOrbit().viewportRef` (or `<Orbit viewport>`): gestures land there and
the dolly anchors there, so a toolbar or a timeline beside the picture no
longer throws the anchor off or takes the camera's gestures.

`CameraGestures.pinch` takes `'trackpad'` or `'touch'` as well as a boolean, on
every camera. Two fingers are pointers, so an instrument handing every press to
its own tools can now keep the trackpad's pinch, which it previously had to
give up with them.
