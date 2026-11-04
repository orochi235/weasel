---
"@weasel-js/core": patch
"@weasel-js/renderer": patch
---

Pick by what a canvas painted. `<SceneCanvas geometry={{ picking: 'pixels' }}>` takes its presses, hover and the
`nodeAtPoint` dep from the canvas's id frames, so a custom shader, an effect, or a texture's transparent parts pick
as they look rather than as their outline. Each pick reads the few pixels around the point, leaving out the nodes it
has already found, so a node covered by another is still found and an `exclude` sees what is beneath the nodes it
names. It falls back to `'shape'` before the first paint, without WebGL2, and for a pick asked for another view.

The canvas handle gains `readIds(rect, options)`, the ids the canvas last painted over a rect; `pickAt` reads through
it, and both take `exclude`, the `pickId`s to leave out. `WeaselRenderer.renderIds` takes `exclude` as well.

An id read for a point off the drawing now reads nothing, where it used to read the nearest edge pixel when the point
was left of or above the drawing, and `renderIds` restores the context's framebuffer when a frame throws.
