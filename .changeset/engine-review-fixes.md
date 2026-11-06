---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/dither': patch
---

Rotate by Measurement turns a stroked selection about the center of its drawn boxes, as a rotate drag does, rather than its pose boxes'.

Inside `<SceneCanvas>`, snapping measures with the `drawnBoxes` and `boundsIncludeStroke` deps, so a host that overrides them snaps to the same boxes its move, align, resize and rotate measure. `createSnapSession2d` takes a `drawnBoxes` source for a host without a canvas.

`Effect` gains `screenAnchored`, for a pass whose result depends on where in the drawing buffer a pixel lies. A retained layer running one is drawn again through a pan instead of being moved, and `dither()` sets it for a Bayer pass or an output grid, whose pattern used to slide with the content and snap back.
