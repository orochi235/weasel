---
'@weasel-js/core': patch
---

A parallax plane draws its source layers through `drawOneLayer`, so their
`space` means something.

`createParallaxLayer` called `layer.draw(...)` directly where every other path
through a view — the canvas itself, a viewport node's inner pass — goes through
`drawOneLayer`. A `space: 'world'` source therefore came out unprojected, and the
only way to see anything was for the source to pre-project by hand while
declaring a space it did not draw in. ParallaxDemo's four layers did exactly
that, and their labels were lies.

Now a world-space source is wrapped in the plane's inner view and a screen-space
one is passed through, the same rule that holds everywhere else. The plane
itself stays `space: 'screen'` — its children carry whatever transform they
need, and the outer canvas must add none.

The demo drops its `project` helper and emits world coordinates; the committed
`parallax` visual baseline passes unchanged.
