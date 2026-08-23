---
'@weasel-js/core': patch
---

Add `createViewResolver` — which view owns a client point, held steady for a
gesture.

A canvas with viewport nodes on it has more than one camera, and a pointer event
belongs to exactly one of them. The resolver hit-tests a list of
`ResolvableView`s (a camera plus the rect it paints into) in reverse paint
order, right and bottom edges exclusive, and falls back to the root view.

It pins a pointer on `begin` and releases it on `end`, so a drag that leaves its
view's rect — over a neighbour, or off the canvas — keeps reporting coordinates
in the space it started in. Without that, a marquee crossing a panel edge
silently starts measuring against the wrong camera. A pointer that began on the
root canvas is pinned to the root for the same reason. The pinned view is looked
up fresh each call, so a rect that moves mid-gesture is honored.

`ViewTarget.origin` is the resolved view's client-space origin, ready to pass
straight to `clientToWorld`. `ViewportLayer.resolvable(outer, dims)` supplies a
viewport node as a candidate.

Nothing is wired into the dispatcher yet: tools still target the outer view.
