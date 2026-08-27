# A node's stroke is a paint, not a color

Status: proposed.

For someone writing a node painter in `@weasel-js/core`, or wiring a property
panel to one. It answers: what a node's `data.stroke` may hold, what picking
does with it, and what edits it.

## The rule

```ts
export type NodeStroke = string | Stroke;
```

A string is a color, `'none'` and absence both mean no stroke, and an object is
a core `Stroke` used as-is — paint, width, cap, join, dash, miter limit, align.
`resolveNodeStroke` sits beside `resolveNodeFill` in `NodeShape.ts` and is the
only place the union is read. Nothing downstream has to change to receive it:
`PathDrawCommand.stroke` has been the full `Stroke` since the paint model
landed, and the tessellator implements every field. The narrow piece is the
node-data mapping in the two built-in painters.

The object form **wins outright** over the `data.stroke` / `data.strokeWidth`
pair: a caller that has reached for the full `Stroke` is not also asking for the
color-string fields, so `data.strokeWidth` is ignored rather than merged. Same
rule `withLeafStroke` already applies when a text node carries both. A `Stroke`
with no `width` paints at 1, matching the renderer's own `stroke.width ?? 1`.

Two things fall out that are easy to miss:

- **A stroke paint needs `fillInPoseFrame` too.** `kit:path` bakes the pose into
  the projected path rather than emitting a transform, so a bounds-relative
  gradient handed to the renderer unbaked refers to a frame that never exists.
  The fill already goes through `fillInPoseFrame` + `resolveFillPattern`; the
  stroke's paint has to take the same route.
- `kit:shape` never had `kit:path`'s `'none'` check. Once both read through one
  resolver, they agree.

## Why one union and not a second field

A `data.strokeStyle` beside `data.stroke` would leave two sources of truth for
one visual and force every reader to decide precedence for itself. `data.fill`
faced the same choice and answered it — `NodeFill = string | FillStyle` — so the
resolver shape, the `'none'` handling, and the object-wins rule are all already
written down in working code. Diverging here would mean a node whose fill and
stroke are read by two different conventions in adjacent lines of the same cast.

## Picking: `NodeInk` cannot stay a scalar

`NodeInk.strokeWidth` is one world-unit number, and `shapeCoversPoint` spends it
as a symmetric band around the silhouette (`reach = strokeWidth / 2 +
tolerance`). That is exact for a centered stroke and wrong for the two cases the
union admits:

- `align: 'inner'` puts no ink outside the silhouette at all; `'outer'` puts a
  full width outside and none inside. One number cannot say which.
- `width: { px: n }` is screen pixels, and `ink(node, pose)` has no view scale.

So `NodeInk` becomes `{ filled, outset, inset }` — world units, measured from
the silhouette outline, per side. `ink` gains an optional third argument
carrying the view scale, mirroring the `NodePaintCtx` that `paint` already
takes, and resolves `{ px }` through `resolveStrokeWidth`; absent, scale is 1,
which is today's behavior. `findShapeInk` normalizes a painter that still
returns `{ strokeWidth }` to `outset = inset = strokeWidth / 2`, so painters
outside this repo keep working unchanged.

`shapeCoversPoint` then picks the reach by side, which costs one
`pathContainsPoint` on unfilled shapes that today skip it. Both `NodeInk` and
`findShapeInk` are public exports; this is the one part of the change a consumer
can see in its own types.

## The union has to be edited as a union

`defaultNodeProperties` binds a `color` leaf to `data.stroke`. Point a color
swatch at a path that can hold an object and it reads `undefined`, displays its
default, and writes a bare string over the whole `Stroke` on first touch —
`ToolPref`'s own docs spell this out for `…fill.color`, and `SelectionPanel`'s
`color` case is exactly that path today.

So `data.stroke` becomes a leaf of a new `stroke` kind whose control writes a
whole value back, preserving whichever form the node holds: a color string
stays a string, and an object keeps its width, cap, join and dash and takes a
new solid paint. `setStroke` and `setStrokeOpacity` need the same care plus the
`typeof prev === 'string'` guard `setFill` already carries — without it, an
object-form stroke is silently stringified the first time someone drags the
opacity slider.

**`data.strokeWidth` stays a leaf of its own**, and the control does not
promote a color string into a `Stroke`. Promotion would have to carry the
node's existing `data.strokeWidth` into the object and then leave that field
stranded — read by nothing in the kit, still read by WeaselDraw's SVG
exporter, which would then export a width the canvas is not painting. Editing
cap, join and dash from a panel therefore waits on the SVG mapping in arc 3;
until then the rich form is authored programmatically and edited safely.

`PrefsForm` renders neither `paint` nor the new `stroke` kind today; it falls
through to `({kind}: no renderer)`.

## Arcs

1. `NodeStroke`, `resolveNodeStroke`, both painters, the two setter actions, and
   the `NodeInk` split.
2. The `stroke` pref kind, its `SelectionPanel` control, and `PrefsForm`'s
   missing cases — every control that touches the union reads and writes it as
   a union.
2b. Cap / join / dash rows, once arc 3 has taught the SVG path the object form.
   Ordered after it because a panel that can mint a rich stroke in WeaselDraw
   before its exporter understands one produces files that do not match the
   canvas.
3. `@weasel-js/svg`'s `unpack` stops flattening — gradient stroke paints,
   dashes, caps, joins and miter limit survive import, and `SvgStroke.opacity`
   lands on the paint's own `opacity`. `unpack.test.ts` currently *pins* the
   flattening ("the painter has a color slot, not a paint one"); that assertion
   inverts. The serializer already emits from a full `SvgStroke` and needs
   nothing.

## What this deliberately does not do

Bounds still ignore stroke entirely — nothing in the tree inflates a pose by
stroke width, so an outer stroke has always hung outside its node's box. The
union makes that visible at larger widths without causing it.

`apps/draw` keeps its own string-only `PathObj` until it chooses to widen; the
union is additive, so nothing there changes on its own.
