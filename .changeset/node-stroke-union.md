---
'@weasel-js/core': patch
---

A node's `data.stroke` takes a whole `Stroke`, not just a color

`NodeStroke = string | Stroke`, mirroring `NodeFill`. A string is still a
color and `'none'` still skips the stroke; an object is a core `Stroke` whose
`width`, `cap`, `join`, `dash`, `miterLimit` and `align` all reach the
renderer, which has accepted them on `PathDrawCommand` all along. The object
wins outright over `data.strokeWidth` rather than merging with it, the same
rule `withLeafStroke` already applied to text. A bounds-relative stroke paint
is baked onto the pose box the way a fill is, so a gradient stroke resolves
against the box it was authored against.

`kit:shape` now honors `stroke: 'none'`, which only `kit:path` checked before.

`NodeInk` reports `{ filled, outset, inset }` instead of `{ filled,
strokeWidth }`: `align: 'inner'` puts no ink outside the silhouette and
`'outer'` none inside, which one number could not say, so picking grabbed the
wrong side. `ink` takes an optional context carrying the view scale, so a
`{ px }` stroke width resolves to world units. A painter that still returns
`{ filled, strokeWidth }` is read as a centered stroke and keeps working.

`setStroke` and `setStrokeOpacity` no longer stringify a node's `Stroke`: a
color pick replaces its paint and keeps width, cap, join and dash, and an
opacity drag sets the paint's `opacity`, which is the only form that works on
a gradient stroke.

Editing UI for the rich form is not here yet — a schema-driven color control
still writes a bare string over the object, so nodes carrying one are for
programmatic authorship until `SelectionPanel` learns the union. See
`docs/proposals/2026-08-26-node-stroke-union.md`.
