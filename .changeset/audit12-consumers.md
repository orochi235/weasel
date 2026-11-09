---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
'@weasel-js/path-tools': patch
---

Fixes to how the hand, pencil and slice tools, the 3D camera actions and the trim tool take their gestures.

- The hand tool pans on a drag with Shift, Alt, Ctrl or Cmd held. Before, a held modifier kept its drag from matching, so the drag went to whatever sat under it: a Shift-drag on a selected node moved the node, and an Alt-drag cloned it.
- The pencil draws a stroke that starts over a shape, as the other insert tools do. Before, its drag matched only on empty canvas, and a drag starting on a shape moved the shape.
- With a slice cut pending, an Alt-drag places one more point where it is released, as a plain drag does, rather than cutting freehand on its own.
- `camera.orbit`, `camera.pan` and `camera.pinchDolly` hand a drag or pinch on to the next binding when the view has no `camera3d` dep. `camera.dolly` passes on a wheel or pinch it does nothing with (no camera, or a wheel that only moves sideways), and `camera.home` passes on a double click when there is no camera or no `home`. Before, each took the input and did nothing, so no other binding, and for a wheel not the page either, saw it.
- The trim tool clears its dashed preview of the piece under the pointer when the pointer leaves the canvas. The warp tools' option docs give Envelope's default key as Shift+F, which it is.
