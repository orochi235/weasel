---
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
---

A wheel or trackpad-pinch zoom in a `<CanvasView>` keeps the point under the pointer still, wherever the view sits on the canvas.

The event's `clientX`/`clientY` are now in the routed view's own pixels, the space its camera anchors in; a canvas with no views still reads canvas-local.

<!-- entry: fix -->
