---
'@weasel-js/core': patch
---

Paint a gradient or pattern stroke instead of throwing.

`Stroke.paint` has always been a full `FillStyle`, and SVG import puts paint
servers there deliberately, but the renderer refused anything but a solid — so
importing a shape with `stroke="url(#grad)"` produced a scene that threw on the
next frame. Both stroke paths now paint the ribbon through the same route a
fill takes, including under the inner/outer alignment stencil. A non-solid
even-odd fill no longer renders black.
