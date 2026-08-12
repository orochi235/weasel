---
"@weasel-js/core": minor
"@weasel-js/ui": minor
---

Gradient fills that stay attached to their shape, and an editor for them.

Gradient geometry was interpreted in screen space: `draw.ts` set the shader's
`u_worldInv` to the identity matrix, with a comment saying a later step would
wire the real view inverse. Nothing did. Every gradient therefore slid across
its own geometry under pan and zoom, which is why the gradient demo shipped
with pan and zoom disabled. Fine for a viewport-fixed wash, useless for a
paint on a shape.

Gradient paints now carry `units`, mirroring SVG's `gradientUnits`:

- `'bounds'` — fractions of the painted node's box, `0..1` per axis (SVG
  `objectBoundingBox`). Resolved by the node painter, so the paint follows the
  node through moves, resizes and rotation.
- `'local'` — the frame the geometry was handed to the renderer in.
- `'world'` — scene coordinates; the paint holds still while geometry moves
  through it (SVG `userSpaceOnUse`).
- `'screen'` — surface pixels, and the default, so every existing gradient
  keeps the behavior it had. WeaselDraw's workspace tint wants exactly this.

`WeaselRenderer.render` takes an optional view matrix for `'world'`, and falls
back to screen space without one. `fillInPoseFrame` resolves `'bounds'` against
a box and `fillToBoundsFrame` inverts it; `mat3.invert` is new alongside them.
Supporting helpers: `sampleGradientStops`, `withGradientKind`,
`gradientGeometry`, `gradientForBounds`.

`setFill` takes a whole `paint` as well as a `color`, so a gradient edit is one
undo entry like any color edit. A `color` no longer tries to inherit alpha from
a fill that is a gradient.

New in `@weasel-js/ui`: `<GradientEditor>` (kind switch, stop strip, per-stop
color) and `<GradientHandles>` (on-canvas endpoint / center / radius / angle
handles, positioned through consumer-supplied `toScreen` / `toLocal` so it
needs no view or scene of its own). Both split live `onInput` from committed
`onChange`.

Converting between kinds is lossy in ways the data makes unavoidable: a radial
gradient stores no angle, so a round trip through one leaves the segment
horizontal, and a conic stores no radius, so a round trip through one resets
the segment's length.

`'bounds'` is not a frame you can do polar math in: `x` and `y` are fractions
of two different lengths, so a circle in it is an ellipse on screen.
`<GradientHandles>` therefore takes a gradient already resolved by
`fillInPoseFrame`, and consumers convert edits back with `fillToBoundsFrame`.
