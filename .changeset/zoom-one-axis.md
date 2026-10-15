---
'@weasel-js/core': patch
---

Zoom can be held to one axis. `viewport={{ zoom: { axis: 'x' } }}` makes the wheel, the trackpad pinch, and Cmd+=/- scale only x, leaving y's scale and translation alone; `pinchZoom: { axis }` does the same for a two-finger pinch, which still pans on both. `makeViewportZoomAction` and `makePinchZoomAction` take the same option, and `axisZoomFactor` and the `ZoomAxis` type are exported for a host calling `zoomAt` itself. Additive.
