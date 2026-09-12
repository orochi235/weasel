---
'@weasel-js/labkit': patch
---

A shared surface now clears itself when its tiles move.

Cloning a trial, closing one, or resizing the window left the previous layout's
pixels wherever the new layout does not cover: a tile that moves or shrinks
takes its scissor with it, and nothing paints over what it vacated. In the 3D
lab that read as a second viewport smeared across the gap between panels.

`SurfaceFrame` gains `retiled` — true on any frame where the tile geometry
changed — and `SurfaceHandle` gains `registerClear(id, fn)`. Every registered
clear runs, before any painter, on such a frame. It has to be the tenant's
call and not the painter's, because tenants paint in sequence and the second
would wipe the first; and it cannot be the owner's, because labkit owns the
canvas and never the context. `canvas.width = <its own value>` is not a way
out: assigning the same value resizes nothing, so it clears nothing.

Two smaller fixes ride along. An invalidation the owner makes from inside
`onFrame` — what sizing the buffer forces — was discarded by the frame loop's
trailing clear, so a resize could leave tiles blank until something else
dirtied them. And painters now see what the owner dirtied during the same
frame rather than a frame later.
