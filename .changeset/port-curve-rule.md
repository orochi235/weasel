---
"@weasel-js/geom": patch
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

State the port-curve rule once, in `@weasel-js/geom`.

A routed edge leaves a port along its normal and arrives at the next against
that port's normal, with the controls reaching 0.4 of the straight-line
distance. That rule lived inside `@weasel-js/diagram`'s `bezier` router with
its reach constant module-private, so a 3D consumer had no way to share even
the number.

It is now `portControls` / `portCurvePoints` / `PORT_REACH`, exported from
both `@weasel-js/geom` and `@weasel-js/geom/3d`. One implementation over loose
components sits behind both, so the two dimensions cannot disagree: every
operation in it is closed on the plane z = 0, and a planar problem answered
through the 3D entry returns the same numbers, not an approximation. Each
barrel wraps it in its own tier's currency — scalars for 2D, matching
`cubicEvalAt`, and `Vec3` for 3D.

`bezier` is unchanged in behavior; it calls through. `@weasel-js/diagram` now
declares the `@weasel-js/geom` peer it had been importing without.

Also moves `Vec2`'s declaration out of `core/geometry/polygonHitTestRect.ts`,
a polygon-versus-rect hit-testing helper it had been an incidental local in,
into `core/geometry/vec2.ts`. No API change — the barrel exports the same
type from a place you would look for it.
