---
'@weasel-js/core': patch
---

A canvas's `clientToWorld` override reaches the views declared on it. Which `<CanvasView>` a client point is in, where it lands in that view's world, and the `pointer` dep's position over a view were all worked out from the element's bounding rect, so a canvas under a CSS transform routed a press to the wrong view or converted it wrong.

Breaking, in the experimental view resolver: `createViewResolver` takes `toLocal(clientX, clientY)`, a client point in the canvas's own pixels, where it took `canvasOrigin`; and a `ViewTarget` carries `world`, the point in the resolved view's world, where it carried `origin`.
