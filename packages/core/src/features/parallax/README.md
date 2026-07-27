# parallax

Multi-plane parallax: render the same layers through *derived* views so
background planes move less than the camera and foreground planes move more.

Two files — one pure function, one layer wrapper.

## `deriveParallaxView(outer, opts)`

Pure. Takes the camera `View` and per-plane factors, returns the plane's inner
`View`. No state, no side effects — trivially testable, and reusable anywhere
you need "a view that tracks the camera at a fraction."

| Option | Meaning |
| --- | --- |
| `pan` | How much the plane translates with the camera. `1` = normal, `0` = locked to `anchor`, `>1` = leads the camera. |
| `zoom` | How much it scales with camera zoom. `1` = normal, `0` = fixed at identity scale. |
| `anchor` | The world point every plane agrees on. Defaults to the origin. |

Both `pan` and `zoom` take a scalar or `{x, y}`, so you can parallax one axis
only — common for side-scrolling backdrops.

**Identity holds:** `pan: 1, zoom: 1` returns a view equal to `outer`. That's
the invariant to preserve if you touch the math; a plane at defaults must be
pixel-identical to no parallax at all.

## `createParallaxLayer`

Wraps source layers so they draw through a derived view instead of the camera
view. Stack several with different factors to get depth.

## Picking `anchor`

Every plane converges at `anchor` — it's the one world point where all planes
line up regardless of their factors. Put it where you want the composition to
stay registered (often the focal point of the scene, not the origin). Getting
this wrong is the usual cause of "the parallax looks right in the middle and
drifts apart at the edges."
