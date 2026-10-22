---
"@weasel-js/geom": patch
"@weasel-js/labkit": patch
---

Each lens body in `LensOverlay` carries a zoom slider along the bottom of its rim, stopping at every power of two from
1× to 64×, the factors the `=` and `-` keys step through. Dragging it sets the factor as those keys do, resizing the
reticle with it, and a whole drag is one undo entry; a press on it never moves or selects the body. It lies on an arc
on a round body, on an ellipse on a stretched one, and runs straight on a square. A lens's readouts now sit at the top
of its interior, clear of the zoom. `@weasel-js/geom` adds `ellipseShape`, an elliptical arc track addressed by
fraction of its length, which `trackShapeD` draws as true elliptical arcs; with equal radii it is `arcShape`'s arc.
`TrackShapeKind` gains `'ellipse'`, so an exhaustive switch over it no longer typechecks until it handles one.
