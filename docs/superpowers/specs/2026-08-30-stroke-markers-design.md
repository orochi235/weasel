# Stroke markers design

**What this is:** the design for arrowheads and other line terminators in `@weasel-js/core`, as
stroke style rather than as a diagram feature. Arc 2 of
`2026-08-28-diagram-plugin-design.md`, independent of the derived-geometry arc.

**Who it's for:** whoever implements it. Assumes weasel's paint model, the stroke tessellator,
and `@weasel-js/svg`'s parse/serialize round-trip; assumes no memory of the conversation that
produced this.

**What it answers:** what a marker is, where its geometry comes from, how the stroke stops
short of a filled tip, and what crosses the SVG boundary.

## Why this is core and not `packages/diagram`

Markers are SVG presentation attributes, siblings of `stroke-dasharray` and `stroke-linecap`.
`packages/svg/src/parse.ts:532` already enumerates that exact group and handles every member
except markers. Putting arrowheads in a diagram plugin would either force `@weasel-js/svg` to
depend on `diagram` — the wrong direction — or make diagram edges lose their arrowheads on
export.

## The rule this design follows

Diverging from SVG is fine where we are doing something better; it is not fine where we are
merely leaving something out. The inset below is the first kind. `marker-mid`, fixed-angle
`orient`, and absolute marker sizing are all present because dropping them would have been the
second kind.

## The model

Three fields on `Stroke` (`packages/paint/src/paint.ts:130`), beside `cap` / `join` / `dash`:

```ts
markerStart?: MarkerRef
markerMid?:   MarkerRef
markerEnd?:   MarkerRef

type MarkerRef = MarkerKey | { key: MarkerKey; size?: number | { px: number } }
type MarkerKey = KitMarkerKey | (string & {})   // KitMarkerKey = the built-in table below
```

`size` reuses the `number | { px: number }` idiom `Stroke.width` already has: a bare number
scales with stroke width, `{ px }` pins absolute size. That is SVG's `markerUnits` in an idiom
the codebase already resolves at draw time.

**One size unit is the resolved marker size**, which defaults to the resolved stroke width. All
geometry and every inset below is expressed in those units, so one entry is correct at any line
weight.

`MarkerKey` stays open (`(string & {})`) the way `PaintKind` does, so a consumer's key typechecks.
Keys are strings, so markers cost `SceneRegistry` nothing — unlike `derivePath`, nothing here is
a function on a node, and JSON round-trip is free.

## The registry

Follows `registerPaintKind` (`packages/core/src/core/paintKinds.ts`), not `registerNodeShape`.
The diagram spec names `registerNodeShape` as the idiom, but that registry resolves by
first-matching predicate and its `id` is explicitly not a lookup key. A marker key is a literal
string in `stroke.markerEnd` and wants `Map.get`. `registerPaintKind` is the kit's one genuinely
string-keyed registry: module-global `Map`, a `BUILTINS` array seeded at load, `listMarkers()`
for enumeration so a property panel can render a picker, a disposer, and re-registering a
built-in id as an override that restores the built-in on dispose.

```ts
interface MarkerEntry {
  id: string                                   // 'kit:arrow', 'app:my-head'
  path(ctx: MarkerCtx): Path                   // anchor at origin, pointing +X, in size units
  fill?: FillStyle | 'line' | 'none'           // default 'line'
  outline?: { width: number; paint?: FillStyle | 'line' } | false
  inset?: number                               // default 0
  orient?: 'auto' | number                     // default 'auto'
  toSvg?(id: string, entry: MarkerEntry): string
}
```

`MarkerCtx` carries the resolved size and the stroke it belongs to, so an entry can vary its
geometry with line weight. Entries that don't need it ignore the argument and return a constant
path, which the registry may cache.

`'line'` means the stroke's own paint — SVG 2's `context-stroke` as the default rather than an
opt-in, so a red edge gets a red head with no second definition.

`fill` and `outline` are independent because the UML aggregation diamond is filled *and*
outlined; a single `mode: 'fill' | 'stroke'` cannot express it.

Geometry is authored anchor-at-origin rather than carrying `refX`/`refY`. This loses nothing —
an entry draws its geometry wherever it likes relative to the origin — and removes an attribute.
Likewise a start marker is reversed automatically, which is SVG's `auto-start-reverse` as the
only behavior rather than an opt-in flag.

`toSvg` is the slot that lets `@weasel-js/svg` emit a `<marker>` def without `core` importing
`svg`. `PaintKindEntry` already solves the same cross-package problem the same way.

## Built-in vocabulary

Inset is in size units, and is a property of the shape, not a setting on the stroke.

| key | geometry | fill / outline | inset |
|---|---|---|---|
| `arrow` | filled triangle, length 3, half-width 1.5 | fill | 3 |
| `arrow-open` | stroked V, arms 2.5 at ±30° | outline | 0 |
| `arrow-concave` | notched triangle | fill | 3 |
| `diamond` | length 4, half-width 1.2 | fill | 4 |
| `diamond-hollow` | same outline | outline | 4 |
| `circle` | r 1, centered 1 back | fill | 2 |
| `square` | side 2, tangent to the vertex | fill | 2 |
| `bar` | perpendicular tick | outline | 0 |

## The inset — the departure from SVG

SVG paints a marker on top of a line that still runs to its full endpoint. With an opaque head
you get away with it; with a hollow, translucent, or narrow head the stroke spikes through the
tip. SVG offers no mechanism, so authors fudge `refX` to pull the head back, which means the
arrow no longer points at the thing it points at.

We stop the stroke short instead. It cannot be one global number: give an open V an inset and
its arms no longer meet the line; give a filled triangle none and it spikes. Hence per-entry.

**Implementation:** a `Polyline → Polyline` trim pass at
`packages/core/src/features/paths/tessellate/stroke.ts:103`, beside `splitForDash`, which
already walks arc length, splits mid-segment at `t = remaining / segLen`, and interpolates the
`anchorA/anchorB/anchorT` params across the split (`stroke.ts:404-431`). Reuse that; do not
write a second copy.

- **Trim runs before dash**, so the dash pattern fits the visible line rather than running off
  under the head.
- **Trim applies to open subpaths only.** `extractPolylines` returns one `Polyline` per subpath
  with `closed` per subpath; a closed one has no start or end tip.
- **Position and tangent at the ends are already computed** — `emitCap` (`stroke.ts:268-273`)
  derives both plus the start-vs-end sign flip. They must be captured from the *untrimmed*
  polyline, since trimming moves the endpoint.
- **`marker-mid` fires at authored anchors**, which are the polyline points where
  `anchorA === anchorB && anchorT === 0`. Orientation is the bisector of the incoming and
  outgoing directions. `emitJoin` (`stroke.ts:504`) already holds both adjacent segments and the
  turn-direction cross product; the bisector itself is new. Mid markers never trim — trimming an
  interior vertex would cut the line in two.

## Rendering

Markers emit their own `PathDrawCommand`s alongside the stroke, rather than appending triangles
to the ribbon mesh. Folding them in would save draw calls but breaks as soon as an entry has
both a fill and an outline or a paint differing from the line's, and it would drag the whole
marker vocabulary into the ribbon cache key. Cost is up to 3× commands on a heavily-marked path,
which is the right trade at diagram scale.

**The ribbon cache key must grow the inset.** `configKey`
(`packages/core/src/renderer/cache/strokeMeshCache.ts:36`) enumerates geometry-affecting stroke
fields explicitly; a missed one is a stale ribbon with every test green. The marker *identity*
does not belong in the key — only the trim distance changes ribbon geometry.

## Hit-testing and bounds

`inkReach` (`packages/core/src/canvas/NodeShape.ts:538`) derives grab reach from `align` alone,
so a marker would extend past the path end and be invisible to picking. Under the kit's "visible
chrome is always hittable" rule, `inkReach` grows by the marker's extent. This also feeds bounds,
selection chrome and snapping.

## SVG round-trip

Export emits `marker-start` / `-mid` / `-end` plus a `<marker>` def, with **full-length path
data** — what SVG means, and it re-imports through our own parser losslessly. The visible
divergence is confined to hollow closed heads, where other renderers show the line crossing an
interior we leave clean.

Baking the trim into the exported `d` was rejected: re-import would trim an already-short path,
so every export/import cycle eats another head-length off the line.

Sites to change:

- `packages/svg/src/cascade.ts:28` — `INHERITABLE`. Marker attributes are inherited in SVG.
- `packages/svg/src/parse.ts:484` (`readStroke`), `:532` (`STROKE_KEYS`), `:555` (`coreStroke`).
  Note `readStroke` early-returns `undefined` when neither `stroke` nor `stroke-width` is
  present — a marker-only element currently yields no stroke object to hang a marker on.
- `packages/svg/src/serialize.ts:265` (`coreStrokeAttrs`) **and** `:290` (`strokeAttrsFor`).
  Two near-duplicate emitters; both need the attributes.
- `packages/svg/src/serialize.ts:118` (`registerPaintServers`) — the pre-pass that guarantees
  `<defs>` precedes any reference to it. Marker defs register here. Key by marker key, not by
  object identity as paint servers do, so one arrowhead reused across hundreds of edges emits
  one def.
- `packages/svg/src/unpack.ts:112` (`strokeDataFromSvg`), `apps/draw/src/svgInterop.ts:165`
  (`objStrokeToSvg`) — the third and fourth `SvgStroke ⇄ Stroke` conversions.
- `packages/svg/src/gradients.ts:37` — `warnUnsupportedDefsChildren` warns on every non-gradient
  `<defs>` child. Add `marker` to the allow-list. `parse.ts:38` `IGNORED_TAGS` likewise, for a
  `<marker>` outside `<defs>`.

**An imported `<marker>` we have no key for warns and drops**, matching how every other
unmodeled def behaves today. The entry model above is deliberately general enough to *hold* an
imported marker — geometry, independent paints, anchor, orientation — so ingesting one later is
a parser change, not a redesign.

## Other enumeration sites

Adding a stroke field means touching every place that lists them. Beyond the SVG cluster:

- `packages/core/src/features/paths/tessellate/stroke.ts:63` — the `??` default block. There is
  no central stroke-defaulting layer; each consumer defaults inline.
- `packages/core/src/renderer/cache/outlineStrokeMeshCache.ts:70` and
  `packages/text/src/layout/layoutRuns.ts:296` (`strokeKey`) — the glyph-outline cache key and
  the text draw-call grouping key.
- `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts:96` — the `data.stroke` schema
  leaf the SelectionPanel renders. `strokeDashEncoding` (`:31`) is the model for a marker picker.
- `packages/ui/scripts/icons/paint.mjs` → `npm run gen:icons`. Per `docs/CLAUDE.md`, proof glyphs
  at 10–15×, then check 1× and 2× separately; path order is z-order.

## Naming

`packages/core/src/features/paths/markers.ts` already exists and is unrelated — `circlePath` /
`squarePath` builders for selection chrome, scoped by its own header to transient decorative
geometry. Stroke markers go in `features/paths/strokeMarkers.ts`; leave the existing file alone.

## Testing

- **A visual baseline on a filled marker.** The inset is invisible to a geometry test and
  obvious in a render. Baselines are `captureCanvas(page, '/#<demo-id>')`, so this requires the
  demo below to exist.
- **A cache guard**: same path, same stroke, different marker inset must miss the ribbon cache.
  `strokeMeshCache.test.ts:23` is the existing shape. Write the version that omits the inset from
  `configKey` first and watch it return a stale ribbon.
- **Trim on a multi-subpath path** — one `d` with two `M`s trims four ends, not two.
- **An open marker trims nothing.** Guards the per-entry inset against collapsing to a constant.
- **Round-trip**, extending `roundtrip.test.ts:204` and the random stroke generator at
  `roundtrip-property.test.ts:59`. The property test asserts zero warnings, so an unhandled
  marker fails there first.
- **`warnings.test.ts`** — assert the `<marker>` warning is gone for a known key, present for an
  unknown one.

## Demo

`apps/site/demos/` gains a terse single-purpose demo showing the vocabulary on a few strokes.
It exists both as the reference implementation and because the visual baseline cannot be
captured without a demo route.
