---
'@weasel-js/labkit': patch
'@weasel-js/core': patch
---

labkit's shared surface and `CanvasStack` take the new backing size when the device pixel ratio changes and nothing resizes, as when a window moves to a display of another density; before, they stayed blurry or oversampled until the next resize. Core exports `watchDevicePixelRatio`, the listener they use.
