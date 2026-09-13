---
"@weasel-js/core": patch
---

`useSceneTextEdit`'s editing overlay now follows the canvas's pan and zoom
without being handed a `view`. It reads the camera from the weasel canvas
mounted inside the `container` it is given — the canvas a double-click landed
on, when there are several — so the overlay's text sits on the glyphs it
replaces at any zoom. Passing `view` still works and still wins.

The overlay is also clipped to that canvas's box, the same place the canvas
clips its glyphs. A zoomed text node used to paint its editor across the page
beside the canvas. Clipping the container with `overflow: hidden` was no fix:
the browser scrolls a `hidden` box to keep the caret in view, so typing past
the edge dragged the canvas sideways. The clip cannot scroll.

`useTextEdit` gains the underlying option, `getClipRect`: a box in container
pixels to clip the overlay to, re-read every frame. The overlay now mounts
inside a clip box of its own, one level below `container`, rather than as the
container's direct child. With no clip rect, nothing is clipped.
