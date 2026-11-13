---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/gestures': patch
---

A two-finger pinch inside a `<CanvasView>` zooms about the point between the fingers, not one offset by the view's position on the canvas.

`InvocationCtx.multiTouch.centroid` is in the CSS pixels of the view the gesture runs in, the space that view's camera anchors in.

<!-- entry: fix -->
