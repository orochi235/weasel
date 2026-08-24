---
'@weasel-js/hud': patch
---

Pick a color by clicking inside the loupe, and stop pixel mode from leaving a
hole while it waits for its first readback.

`createLoupe` gains `onPick` and `LoupeHandle.pick(p?)`: the color the lens is
showing at a point, read off the framebuffer the same way the aim-point readout
is. It maps the lens point back through the magnification — `loupeSourcePoint`
inverts `loupeInnerView` — so picking near the edge of a 16× lens picks the
pixel it draws there, not the one under the click. Where the color goes is the
consumer's; WeaselDraw sends it to the focused swatch and the selection.

A pick declines when the mapped point lands under the window itself, which can
happen with the aim close alongside the frame: the framebuffer holds the window
too, and reading there would report chrome as artwork.

Telling that click from the drag is `WindowOptions.onContentClick`, new on the
window widget — a press and release in the interior that never travelled more
than a few pixels. A bare window's interior is also its move handle, so the two
had to be separable before the loupe could take clicks at all.

Pixel mode now paints the backdrop in every frame rather than only once a
bitmap exists. Before the first readback settles — and whenever one comes back
transparent — the lens had been painting nothing at all, which reads on screen
as a window with the unmagnified canvas showing through it.
