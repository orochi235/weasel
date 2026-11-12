---
'@weasel-js/core': patch
---

A finger dragging or pinching on a `<Canvas>` or `<SceneCanvas>` drives the canvas instead of panning or zooming the page.

The canvas element now defaults to `touch-action: none`, at zero specificity: a class setting `touch-action` on the canvas, `pan-y` say, hands that much back to the page. `<SceneViewCanvas>` and other canvases that take no input are unchanged.

<!-- entry: fix behavior -->
