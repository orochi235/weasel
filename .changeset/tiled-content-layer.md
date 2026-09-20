---
'@weasel-js/core': patch
---

Add `createTiledLayer` — a periodic lattice over any RenderLayer

Content is authored once, in the cell `[0, period)`, and the wrapper draws
every copy the view can see. Panning keeps producing copies in either
direction, so a backdrop loops seamlessly with no wrap-around bookkeeping
anywhere in the source. `tiledProject(visStart, visEnd, period, bleed?)` is
the public helper underneath: the inclusive range of copy indices a visible
span touches.

Each copy draws the source through a view shifted by `-k * period`, so a
source that culls against the view it is handed culls per copy and never
learns it is being tiled; the copy's commands are then translated by
`+k * period`.

Three open questions from the backlog entry, settled:

**2D wrap, and the period names the axes.** `period` is `number | { x?, y? }`:
a bare number wraps x only — the side-scrolling case — and `{ x, y }` wraps
both. There is no separate `axis` option, because two ways to say which axes
wrap is one way for them to disagree.

**The period may be a function of the view and dims**, read per draw. A
constant is the common case, but "one screen wide" is a period too, and a
thunk is the shape every other view-dependent kit option takes.

**The lattice is per layer, not per shape.** Content on two periods is two
tiled layers stacked. A per-shape period would move the lattice into the
source and leave the wrapper unable to cull.

The plane is `space: 'world'`, which is what lets it be a `source` of
`createParallaxLayer`: the parallax plane hands it the derived inner view, the
lattice resolves against that, and the copies ride the plane. A
`space: 'screen'` source is drawn once, untiled — it ignores the view by
definition, so every copy would land on the last.

`bleed` declares how far the content reaches outside its own cell, in world
units, so a shape that overhangs still scrolls in rather than popping in at
the edge of the view.

`apps/site/demos/ParallaxDemo.tsx` is rebuilt on it; its local `tiledProject`
helper and the per-painter period threading are gone.
