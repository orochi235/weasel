# A node's paint is an object

Status: implemented.

For someone writing a node painter in `@weasel-js/core`, or wiring a property
panel to one. It answers: what a node's `data.fill` and `data.stroke` hold,
what picking does with them, and what edits them.

## The rule

```ts
data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
```

`data.fill` is a `FillStyle` and `data.stroke` is a `Stroke` — paint, width,
cap, join, dash, miter limit, align. `null` on either is an explicit "no
paint"; `undefined` takes the painter's fallback, which for a fill is
`DEFAULT_SHAPE_FILL` except on a path that already has a stroke (the pencil
case, where a default fill would be wrong). `solid()` and `strokeOf()` are the
authoring helpers — `resolveNodeFill` and `resolveNodeStroke` in `NodeShape.ts`
are the only readers.

There is no scalar form. A color string in `data.fill`, a `data.strokeWidth`
beside `data.stroke`, and the `data.color` alias were all removed rather than
kept as a compatibility path: two shapes for one concept force every reader to
decide precedence for itself, and old documents rendering wrong is the accepted
cost.

Two things fall out that are easy to miss:

- **A stroke paint needs `fillInPoseFrame` too.** `kit:path` bakes the pose
  into the projected path rather than emitting a transform, so a bounds-relative
  gradient handed to the renderer unbaked refers to a frame that never exists.
  The stroke's paint takes the same route the fill does.
- `kit:shape` never had `kit:path`'s "no fill" check. Both read through one
  resolver now, so they agree.

## Alpha lives in `opacity`

Every paint kind carries its alpha in `FillStyle.opacity`. That is the only
slot a gradient or a pattern has, so it is the slot all of them use, and the
renderer multiplies a solid's hex alpha by it — the two would compound if both
carried the value. `solid()` therefore splits an alpha channel out of the hex:
`solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.

`setFillOpacity` and `setStrokeOpacity` write that field, which is what lets
them scrub a gradient — splicing hex could only ever touch a solid.
`setFill` / `setStroke` given a color recolor the existing paint through
`paintWithColor`, keeping its opacity unless the picked color states one.

## Picking: `NodeInk` is per-side

`NodeInk` is `{ filled, outset, inset }` in world units, measured from the
silhouette outline. One number could not say which side the ink lands on:
`align: 'inner'` puts none outside the silhouette, `'outer'` none inside. `ink`
takes an optional `NodeInkCtx` carrying the view scale, so a `{ px }` width
resolves through `resolveStrokeWidth`; absent, scale is 1. `shapeCoversPoint`
then picks the reach by side, which costs one `pathContainsPoint` on unfilled
shapes that would otherwise skip it.

`NodeInk` and `findShapeInk` are public exports, and `ink` has no second return
shape — a painter outside this repo returning `{ filled, strokeWidth }` does
not type-check and reads as zero reach.

## Editing it

`data.stroke` is an `object` pref leaf: one leaf holding one value, its fields
as `children`. Sibling leaves addressing into it (`data.stroke.width`) would
each write one field of a value they can only half see. `data.fill` is a
`paint` leaf for the same reason a color control cannot be pointed at
`…fill.color` — it reads `undefined` off a gradient, shows its default, and
writes a bare string over the whole paint on first touch.

`dash` has no row: it is a `number[]` and no leaf kind edits one. It survives
import, export and rendering untouched.

## What this deliberately does not do

Bounds still ignore stroke entirely — nothing in the tree inflates a pose by
stroke width, so an outer stroke has always hung outside its node's box. Wider
strokes make that visible without causing it.
