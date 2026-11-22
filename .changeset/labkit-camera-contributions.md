---
'@weasel-js/labkit': minor
---

`<CanvasStack>`, `<Stage>` and `<CameraInput>` take `contributions`, weasel contributions whose input the camera's dispatcher routes.

Each one's actions, deps and bindings are installed on the camera, and its layers' `hitTest`s claim the presses those bindings target, in the camera's frame-local world. None of a contribution is painted.

<!-- entry: api -->
