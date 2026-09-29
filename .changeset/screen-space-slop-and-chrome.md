---
"@weasel-js/core": patch
"@weasel-js/geom": patch
"@weasel-js/routing": patch
---

Picking and selection chrome now hold their screen-pixel sizes exactly under
non-uniform zoom, rotated nodes included. Before, both divided by the mean of
the two axis scales, so at 4:1 a 4px pick slop was 8px on one axis and 2px on
the other, and on a turned node the selection outline, handles and rotate
badge were drawn as a rotated screen rectangle beside the parallelogram the
node actually painted.

- `<SceneCanvas>` picks within `pickTolerancePx` of a node measured on screen.
  `strokeHitTest` takes a `slop: { px, transform }` for this, and
  `shapeCoversPoint`'s `tolerance` accepts `{ px, scale }` alongside a world
  number.
- The selection outline traces the node's projected corners, handles sit on
  them, and the rotate badge sits its `distance` in pixels off the top edge,
  along that edge's normal as it lands on screen. `rotationHandle` takes the
  view's `scale` to do this and now also returns the badge's screen `angle`;
  `standoff` (exported) is the placement both it and the grab
  region use.
- A painted rotate badge is grabbable where it is drawn:
  `createRotationAffordance` takes `handle: { distancePx, hitRadiusPx }`, and
  `<SceneCanvas>` / `<CanvasView>` turn it on when the selection overlay
  paints one. An affordance `point` region takes a `standoff` for chrome that
  floats a fixed distance off an edge.
- The rotate ring's minimum band, and its paint inset, are measured on screen
  for a turned target (`pxExtent` and `annulusSemiAxes` take a rotation).
- Grid lines stay 1px on screen on both axes.
- Resize handles on a turned target are grabbable across the turned square
  they are painted as, not a screen-aligned one. A `point` region takes
  `turned: true` for this; `pointRegionFrame` is the one placement the
  hit-test, the region's square paint and the debug hitbox all read, and
  `screenAngleOf` the one angle the overlay turns its handles by.
- The `debug.slops` overlay draws the regions the hit-test walks — the same
  affordance list, each region's square from `pointRegionFrame` — instead of
  recomputing corner and anchor positions, so it now shows a custom
  `selectTool.handleHitRadius`, turned handles, and anchors on every selected
  path the hit-test offers them on.
- The hitbox debug overlay draws a world circle as the ellipse it lands as, a
  rotated rect turned, and the new `polygon` `HitShape` a point region now
  records.
