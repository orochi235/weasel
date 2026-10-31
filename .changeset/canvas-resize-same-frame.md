---
'@weasel-js/core': patch
---

A canvas left to fill its parent now shows its new size, painted, in the frame its parent resized in, rather than
one frame late at the old size. `<Canvas>`, `<SceneCanvas>`, `<DrawCanvas>`, and `<SceneViewCanvas>` also paint a
commit that changes their size in place instead of on the next frame. `useElementSize` and `useCanvasSize` take
`{ beforePaint: true }` to render their caller with a new size inside the `ResizeObserver` callback; it suits only a
caller whose render lays out nothing outside the observed element, since the browser reports anything else that
resizes there as a loop error. Without it the size arrives in a task after the callback, as before. A canvas's
`onResize` now fires from a passive effect.
