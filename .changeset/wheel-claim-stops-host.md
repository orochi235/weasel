---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

A wheel the gesture dispatcher claims no longer reaches the element's other wheel listeners. It listens in the capture phase and stops the event there, so a labkit loupe over a canvas with its own camera controls — three.js `OrbitControls`, say — zooms the lens alone instead of the lens and the camera together. A wheel no binding claims still reaches them.
