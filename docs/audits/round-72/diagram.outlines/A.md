## Outlines built with a bare `new PathBuilder()` keep world coordinates in Float32 with no origin, unlike their siblings
- where: packages/diagram/src/outlines/figures.ts:27 (roundRectOutline path), figures.ts:223 (person), flowchart.ts:113 (stadiumPath), storage.ts:23,38,140 (cylinder path/detail, cube detail), participants.ts:35,41,58,72 (collections, queue), modeling.ts:22 (component detail), bpmn.ts:33,83 (annulus, subprocess detail)
- scenario: a `roundRect`/`stadium`/`cylinder`/`person`/`queue`/`endEvent` node at x = 5,000,000 world units. `outlinePath` is called with the node's world bounds (connectTargets.ts:77 picks against it); these builders never call `autoOrigin()`, so `build()` stores raw world coords in a Float32Array (step ≈ 0.5 at 5e6), and corners, curve controls and the rim collapse onto a coarse grid, so the shape draws distorted and hit-tests wrong. The same file's `polygonFromPoints`, `polylineFromPoints`, `ellipsePath` and `transformPath` outlines (triangle, octagon, diamond, ellipse, cloud, every `outlineFromD` figure) all pick an origin and stay exact, so precision depends on which outline a node wears.
- evidence: read (geom builder.ts: `autoOrigin` only applies when called; `polygonFromPoints`/`ellipsePath` call it; transformPath.ts:63 picks one)
- severity: medium

## `subprocess.boxForContent` is narrower than the content it was asked for
- where: packages/diagram/src/outlines/bpmn.ts:94 (subprocess.boxForContent)
- scenario: content {width 200, height 20}. `roundRect.boxForContent` sizes the box for the radius a 202×22 box gets (r ≈ 3.69, +2.16 px), then subprocess adds 18 px of height. The resulting 202.16×40.16 box gets a larger radius (min(10, 40.16/6) ≈ 6.69), so `content` insets each side by 1.96 and returns width ≈ 198.2 < 200. The box is supposed to give content "at least" what was asked (types.ts:21), so rows sized to it wrap or clip. Any wide, short label hits this whenever the height, not maxRadius, limits the radius.
- evidence: read (computed from the formulas)
- severity: low

## bpmn.ts redefines KAPPA at a different precision instead of importing flowchart's
- where: packages/diagram/src/outlines/bpmn.ts:28
- scenario: `KAPPA = 0.5522847498`, while flowchart.ts:20 exports `0.5522847498307936`, which figures/storage/participants import, and geom's `ellipsePath` uses its own ELLIPSE_KAPPA. The end event's outer ring of the annulus (`solid`) is meant to coincide with the `ellipse` path stroked under it, but the two are built from different constants. One decision is answered in two places, and the copies drift.
- evidence: read
- severity: low

## The component glyph is drawn at a fixed size, outside the box, for a narrow component
- where: packages/diagram/src/outlines/modeling.ts:17 (component.detail)
- scenario: a component resized to width 16. `left = x + 16 − 6 − 14 = x − 4`, and the tabs reach to `left − 3`, so the glyph's stroke lands 7 px outside the node's left edge, beyond its silhouette and its bounds. `content` clamps its side margin to w/4 for exactly this case, but the detail does not. Every other detail in the area (`ringOf`, `gapOf`, `offsetOf`, `foldOf`, `markerOf`) shrinks with a small box.
- evidence: read
- severity: low

## The globe's silhouette ring is left unclosed, unlike participants' ring helper
- where: packages/diagram/src/outlines/network.ts:24 (ring), used as the path at network.ts:84
- scenario: `globe`'s filled and stroked outline is `ring(0.5, 0.6, 0.4)`, two arcs with no `Z`. The subpath ends where it began but stays open, so the stroke gets caps instead of a join at (0.9, 0.6), which shows as a notch on a thick stroke, and closed-ring consumers see an open contour. participants.ts:18 answers the same "circle as two arcs" with a trailing `Z`, and bpmn.ts:53 again without one.
- evidence: read
- severity: low

## Files read
packages/diagram/src/outlines/bpmn.ts
packages/diagram/src/outlines/figures.ts
packages/diagram/src/outlines/flowchart.ts
packages/diagram/src/outlines/fromD.ts
packages/diagram/src/outlines/modeling.ts
packages/diagram/src/outlines/network.ts
packages/diagram/src/outlines/participants.ts
packages/diagram/src/outlines/states.ts
packages/diagram/src/outlines/storage.ts
packages/diagram/src/outlines/table.ts
packages/diagram/src/outlines/types.ts

<!-- done: 5 findings, files read: 11 -->
