---
'@weasel-js/kernel3d': patch
---

`Camera3dDep` takes an optional `origin()`: where the pane's top-left sits on the canvas, in CSS pixels. `camera.dolly` and `camera.pinchDolly` subtract it from the canvas-local point a wheel or pinch carries, so a host that runs one dispatcher across several panes dollies about the point under the pointer in each of them. Omitted, it is the canvas origin, which is what both actions assumed before.
