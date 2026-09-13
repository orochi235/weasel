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

It also measures until the layout stops moving. `node.placementChanged` fires
when a move is ordered, not when it lands, and a panel whose size settles while
its position is still animating gives `ResizeObserver` nothing more to report —
so a tile painted for the rest of its life at wherever it was caught mid-flight,
which is why cloning a few trials left viewports sitting between their panes.
A measurement that finds anything moved now schedules another, and the run ends
on the first one that finds nothing moved.

