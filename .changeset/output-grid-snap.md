---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Snap marks to an output grid's dots before rasterizing, so a vector mark prints as a whole number of dots. geom adds `snapSpanToGrid` and `snapRectToGrid`, which put edges on dot boundaries and keep a hairline at one dot, and `snapModuleRun`, which rounds a run's module once so every module of a barcode prints the same number of dots. core adds `snapPosesToGrid`, which snaps a scene's marks to snapped world poses without touching the document, and `withPoses`, which wraps a `drawOne` to draw from them.
