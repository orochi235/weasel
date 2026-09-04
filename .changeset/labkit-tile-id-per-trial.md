---
'@weasel-js/labkit': patch
---

Scope a surface tile's id to the trial it is registered in, so two trials of one
instrument no longer share a rect.

A surface's tile namespace is one lab-wide map, but an instrument names its
regions once and every trial of it declares those same names. The second trial
to mount took the first one's entry — its rect, its ResizeObserver registration
and its painter — so the first was never told it had moved again, and kept the
box it was measured at while it was the only trial open: a 666px-wide overlay
standing over a 476px pane, swallowing input meant for its neighbour.

`useSurfaceTile` and `AnnotationOverlay` now register under `useTileId(id)`,
newly exported, which is `<trial>/<id>` inside a trial and `id` alone outside
one. A frame's `rects` are keyed the same way, so a host looking a tile up calls
`useTileId` for the key rather than the name it registered with.
