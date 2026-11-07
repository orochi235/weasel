# Stroke trim: drawing part of a stroke, in pen order

For whoever builds the stroke trim, and later the 3D line pass that consumes it.
Answers: what a trimmed stroke draws, how the trim is specified and animated, and which parts are
dimension-free so a 3D renderer can use them unchanged.

Status: designed and approved by the maintainer (2026-11-01); built on branch `stroke-trim` (2026-11-02).

## Why

Arrows, diagram edges first, should be able to draw themselves on: the line grows from its tail in
the order the path was authored, and the head rides the growing end. The same holds for any stroked
path. astv already does this for its own arrows (`astv/packages/engine/draw/arrows/`: a `travel`
value slides a window along normalized arc length, and the head rides its front); weasel's stroke has
no equivalent. It has no dash offset either, so nothing can be faked with dashes.

## Decisions (2026-11-01)

- **Weasel's 2D stroke pipeline stays.** astv's arrow is not adopted wholesale: it has one head shape,
  an end head only, no dashes, flat color and no export, and diagram edges use all of those. What is
  adopted is its animation model, generalized, and later its 3D line pass (see "Later").
- **The API is 3D-native even though only 2D renders in this cut.** Nothing in the trim type, the
  length table or the queries assumes two dimensions. The math is stated once over component arrays,
  the way `geom/src/portCurve.ts` is, with typed wrappers per dimension.
- **Lengths are measured in the path's own space, never on screen.** Under perspective, screen length
  along a path varies from point to point, so a `{ px }` distance has no single meaning: there is no
  pixel measure.
- **First cut is simple:** the built-in measures and pace below, no per-anchor custom measure.

## The trim

A new type in `@weasel-js/paint`, referenced by `Stroke.trim` and, later, by a 3D stroke:

```ts
/** A position along a path: a bare number is a fraction (see `pace`). */
type TrimAt = number | { length: number } | { anchor: number } | { subpath: number };

interface StrokeTrim {
  start?: TrimAt; // default 0
  end?: TrimAt;   // default 1
  pace?: 'length' | 'anchor'; // default 'length'
}
```

The path is measured in **pen order**: subpaths in authored order, each from its first anchor to its
last. Moving from one subpath's end to the next subpath's start covers no distance and takes no time.

| Position | Means |
|---|---|
| `0.4` | 40% of the way, by whatever `pace` says |
| `{ length: 120 }` | 120 world units from the start |
| `{ anchor: 3.5 }` | Halfway between authored anchors 3 and 4, by length along that segment (flattening's `anchorT` is already this). Anchors count as `countPathAnchors` counts them, across subpaths |
| `{ subpath: 1 }` | Start of subpath 1. `1.5` is halfway along subpath 1 by length |

**The anchor measure, precisely** *(builder-check answers, my call)*:
- Numbering is the **authored** path's. Where `corners` round an anchor into an arc, anchor *n* sits at
  the arc's midpoint and each half of the arc belongs to the neighboring segment; the ribbon's
  expanded anchors map back through `anchorSources`.
- A segment is what the pen draws between two consecutive anchors of one subpath, **including a closed
  subpath's closing edge**. So on a closed subpath, `[last, last + 1)` is the closing edge; on an open
  one that interval is the pen lift and covers no distance. The anchor range is the segment count.
- A closed subpath's **first** anchor is the exception (2026-11-01): it sits where its corner arc ends,
  not at the arc's middle, and the whole arc belongs to the closing edge. `resolveCorners` starts a
  closed contour at that arc's end and draws the arc last, and a window never wraps, so the middle
  would put anchor 0 after the rest of the subpath.

**`pace` says what a fraction is a fraction of.** `'length'`: of total length, so tweening a number
moves the pen at constant speed. `'anchor'`: of the anchor range, each segment an equal share, so
every segment draws in equal time whatever its length. The absolute measures (`length`, `anchor`,
`subpath`) ignore `pace`.

Positions clamp to the path. A window whose start is at or past its end draws nothing, markers
included; it never wraps.

Draw-on is `end` tweening 0 → 1; exit is `start` following it to 1, so the line drains into its tip.
Neither needs a special case.

## What a trimmed stroke draws

- **Only the visible span**, as one or more open runs (one per subpath the span touches).
  A closed subpath the window covers whole stays closed (2026-11-01), so a whole-path trim draws
  the join, not a seam.
- **Markers apply to the visible runs as they apply to untrimmed subpaths:** `markerStart` at
  each run's first point, `markerEnd` at its last, pointing along the tangent there. So the end head
  rides the window's front. A run cut from a **closed** subpath takes no start or end marker, as the
  closed subpath took none. Marker insets apply at the run's ends as they do today.
- **`markerMid` appears on the authored interior vertices inside the visible span**, so mid markers
  pop in as the pen passes them. A vertex exactly at a window end is an end, not interior.
  *(my call)*
- **Dashes stay anchored to the path's start**, so drawing on reveals a fixed pattern instead of a
  pattern that slides as the line grows: each run starts its pattern at the phase the untrimmed stroke
  has there (`splitForDash`'s `phase`, SVG's `stroke-dashoffset`, PDF's `d` phase). Whether a dash
  too fine to draw goes solid is decided on the untrimmed path, so a trim never changes it.
- **A text node's stroke ignores its trim** (2026-11-01): each glyph's outline is stroked on its own,
  so the text has no single pen order for a window to run along.
- **Picking hits only the visible span of the authored `Stroke.trim`.** A trim the animator is
  overriding draw-time does not reach picking in this cut: `strokeHitTest` never sees the override
  table, and a transient draw-on does not justify a new channel into hit-testing. *(my call)*
  Culling bounds may use the whole path: conservative and cheap.

## Dimension-free core

One resolver, used by everything that applies a trim. `paint` and `geom` both have no dependencies
and keep none, so the work splits *(my call)*:

- **`@weasel-js/geom`: a length table**, built from a flat list of points in 2 or 3 components, where each subpath starts,
  and each point's anchor parameter (anchor index plus `t`, which flattening already carries as
  `anchorA`/`anchorB`/`anchorT`). It holds cumulative length per point, per anchor and per subpath.
- **`@weasel-js/geom`: a position query** turns an arc length into a point and a unit tangent,
  returned as `Vec3` (2D callers read z = 0). It also answers the arc length of an anchor parameter
  and of a subpath's start.
- **`@weasel-js/stroke`: `resolveTrim(table, trim)`** turns a `StrokeTrim` into a visible span: a `[from, to]` pair of
  arc lengths, or `null` for nothing.

`@weasel-js/geom/3d` gets the `Vec3` wrappers, as `portCurve3.ts` does. The 2D stroke fills the table
from the corner-resolved path's own curves, measured by exact arc length (2026-11-01), because a
table filled from flattened polylines puts each reader's cut at its own tolerance and moves the
canvas cut with zoom. `measurePath` and `pointAlongPath` read the same table (2026-11-02), so a label
at 0.5 sits where a trim at 0.5 cuts. A trim resolves once on it to curve positions, a segment and its curve parameter, and
every reader cuts its own flattening at those; a dash phase stays in the reader's own measure. The
3D line pass will fill the table from a `Vec3` polyline and depend on `stroke` for `resolveTrim`.

## Where it plugs in (2D, this cut)

- **Ribbon** (`stroke/src/tessellate/stroke.ts`): window the polylines after per-point widths are
  populated and before marker insets and dashing. Measure in world space; the rect-under-metric path
  extracts polylines in metric space, so convert or measure before that.
- **Marker heads** (`stroke/src/markerHeads.ts`, reached from `renderer/src/cache/markerCommandCache.ts`
  and `renderer/src/markerCommands.ts`) extract their own polylines from the corner-resolved path, as
  the ribbon does, and both window them through one `windowTrim` on one length table, so the head
  and the line's end coincide.
- **Picking and pose frames**: a stretch or skew can turn a nearly straight rounded corner below the
  turn corners are cut at, so corners are resolved before a non-uniform pose frame
  (`pathThroughPoseFrame`, 2026-11-02); the framed outline then has the local path's segments and a
  trim's curve positions name the same points on both.
- **Caches**: a stroke too large to batch is built once untrimmed with an arc length on every vertex
  (stroke's `clipRibbon`) and clipped in the shader, each cut end drawn as a little geometry of its
  own (`clipWindow`; renderer `draw/clippedTrim.ts`, 2026-11-03). The clipped ribbon keeps each
  segment's whole quad at a turn, so it covers some ground twice: an opaque solid stroke draws
  straight, and any other marks what it covers on stencil bit 0 and paints its untrimmed ribbon there
  once (2026-11-07). Heads are built once, unplaced, and drawn under the transform their placement
  makes (stroke's `markerPlacements`, renderer `cache/markerCommandCache.ts`), so a trim only moves
  them (2026-11-07). Still rebuilt trimmed, the mesh keyed on the trim: a stroke the batch takes,
  which is small and joins the run it sits in, and one built in a stretched view's metric.
- **Export**: SVG (`svg/src/trimmedStroke.ts`) and PDF (`pdf/src/strokeOps.ts`) bake the trim through
  stroke's `trimmedPath`: they write the visible span's geometry, curves split rather than flattened, so markers land at the window's ends and dashes
  still work. The `pathLength` + `stroke-dasharray` trick is rejected because it leaves markers at
  the original ends and cannot coexist with a dash. Import does not recover a trim.
- **Animation**: per-frame trims must not go through ops or undo history. Mirror the vertex-color
  path: a per-node trim override table on the animator (`TrimOverrideRegistry`, beside
  `ColorOverrideRegistry`), read at draw time by core's canvas through `core/src/canvas/paintOverrides.ts`.
- **Diagrams**: `EdgeStyle` (`diagram/src/dataTypes.ts`) gains `trim?: StrokeTrim`, passed to the
  edge's stroke. An edge animates through the override table by its scene node id.
- **Demo**: one site demo, a small diagram whose edges draw on in sequence through the animator,
  built on the kit's systems per the demo conventions.

## Not in this cut

- A per-anchor custom measure (e.g. recorded pen timestamps; the stylus doesn't record times today).
- The pulse effect astv draws on arrows.
- Animating a trim in SVG/PDF output.

## Later

- **The 3D line pass**: built as kernel3d's `packLines` and `createLinePass` (2026-11-03), from astv's
  `pass.glsl.ts`. Its trim resolves on this cut's length table through `resolveTrim` when packing,
  and its head stands back along its own segment's direction on screen; the package README has the rest.

## Left to the builder, and what was chosen (2026-11-02)

- Names inside `geom`: `lengthTable` for runs, `pathLengthTable` for a `Path`, which is cached per path
  object; `pointAtLength` and `curveSpan` for the queries.
- The internal `Trim` interface in `stroke/src/tessellate/insets.ts` keeps its name; it isn't exported.
- The exporters split curves at the span's ends with `splitCubicAt` / `splitQuadraticAt` at the
  resolved curve parameters.
