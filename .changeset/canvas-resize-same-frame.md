---
'@weasel-js/core': patch
---

A canvas whose host resizes now shows the new size, painted, in the frame the host resized in, rather than one frame
late at the old size. `useElementSize` and `useCanvasSize` commit a `ResizeObserver`'s report before the browser
paints, and `<Canvas>`, `<SceneCanvas>`, `<DrawCanvas>`, and `<SceneViewCanvas>` paint a commit that changes their
size in place instead of on the next frame.
