---
'@weasel-js/labkit': patch
---

The lab header has zoom controls for the focused trial: zoom out, the zoom as a
percentage, and zoom in, with Mod+=, Mod+- and Mod+0 as keys. Clicking the
percentage resets to actual size, about the middle of the view. They drive the
trial's camera through core's `viewport.zoom`, so a step stops at the camera's
own zoom limits. Over a trial with no camera they stay in place, disabled, and
leave the keys to the browser. `<Lab zoom={false}>` leaves them out, and
`<LabZoom>` places them somewhere else.

A camera now publishes itself to the lab: `useCameraView` returns a `CameraView`,
which adds `zoomRange()`, and `<Stage>` and `<CanvasStack>` register it under
their trial's id in the lab's `CameraRegistry`. A component with a camera of its
own can do the same with `usePublishCamera`.
