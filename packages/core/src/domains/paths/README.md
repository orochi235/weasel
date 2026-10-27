# paths

The kit's vector-geometry primitive. `Path` is the canonical shape type — it
replaced the per-shape ad-hoc poses, so rect, ellipse, polygon, star, line, pen
output, and boolean results are all the same type.

The type and the pure math over it — construction, `pathFromD`, bounds,
transforms, distance, sampling, splitting, curve fitting, curve
representations and tessellation — live in `@weasel-js/geom`
(`packages/geom/src/path.ts`, `paths/`, `curves/`, `tessellate/`, and
`booleans/` for the splitting that needs a union). This directory holds what
needs the scene, the renderer or `@weasel-js/paint`, and re-exports the rest by
name so core's public API is unchanged.

## Storage: two typed arrays

An SVG-style command stream, split across:

- command codes in a `Uint8Array` (`PATH_M`, `PATH_L`, `PATH_C`, `PATH_Q`,
  `PATH_Z`)
- parameters in a `Float32Array`

Each command consumes a fixed number of coords (`PATH_CMD_LENGTHS`); the parser
walks both arrays in lockstep. This is why interaction hot loops stay
monomorphic and why heavy editing doesn't generate garbage. Don't "simplify"
this into an array of command objects — the layout is the performance story.

One command stream covers lines, polygons, beziers, and multi-contour shapes
(the inner hole of an "O"), so nothing above needs a special case for compound
geometry.

## `RectPath` vs `PolygonPath`

The two subtypes are distinguished **at the type level** so common-case
machinery — selection AABBs, area-select intersection, rect silhouette
hit-testing — can short-circuit on `RectPath` without paying the polygon kernel
cost. Polymorphic kernels take the `Path` union and dispatch on `kind`.

If you add a kernel, handle both; if you add a fast path, make sure it's
actually reachable (a `RectPath` that gets rebuilt as a polygon somewhere
upstream silently loses the optimization).

## Map of the directory

**In `@weasel-js/geom`** — `paths/builder.ts` (`PathBuilder`, `rectPath`,
`ellipsePath`, `regularPolygonPath`, `starPath`, `linePath`,
`polygonFromPoints`), `paths/pathFromD.ts` (parse SVG `d`), `paths/bounds.ts`,
`paths/pathDistance.ts`, `paths/pathAt.ts`, `paths/unionBoundsPath.ts`,
`paths/transform.ts`, `paths/transformPath.ts`, `paths/compose.ts`,
`paths/splitSubpaths.ts`, `paths/cubicMath.ts`, `paths/schneiderFit.ts`
(curve fitting for freehand), `pathHitTest.ts`, `flatten.ts`, `curves/`
(`./curves` subpath), `tessellate/` (`./tessellate` subpath: fill
tessellation, polylines, trim), `booleans/splitBySegment.ts` (`./booleans`).

> **Path language stance:** external/terse geometry is expressed as SVG path
> data via `pathFromD` — the kit does not define a bespoke path DSL. Builders
> are a co-equal choice, not a lesser one. See `docs/conventions.md`.

**Here** — the pose-rotation convention (`poseRotationOf`) and the pose frame
(`poseFrameOf`) are in `@weasel-js/geom`.

**Transform** — `poseDescriptor.ts`, `originProjection.ts`; `pathInWorld` and
`worldEditToStorage` are in `@weasel-js/geom`.

**Editing** — in `@weasel-js/geom`: `paths/anchorEdits.ts` (the anchor-set
mutations: translate, handle-drag with smooth mirroring, insert-on-segment,
delete-with-refit, scissors, rect select), `paths/handleEdits.ts` (handle
locks and angle snapping), `paths/softSelection.ts` (falloff weights by
distance along the path), the curvature comb
(`paths/curvature.ts`), the balance-handle edits (`paths/balanceHandles.ts`), and the anchor model itself
(`pathToAnchors` / `anchorsToPath`, `PenAnchor`, `nearestSegmentT`). Its
invariant test, `anchorEdits.test.ts`, stays here because it reads an action's
anchor walker.

**Rendering** — `pathLayer.ts`, `markerCommands.ts` (marker heads as draw
commands; the ribbon, the marker registry and `strokeToPath` are in
`@weasel-js/stroke`), plus `penPreviewLayer.ts` (the pen's
in-progress path) and `pathEditingOverlayLayer.ts` (anchor-edit chrome, with
the curvature comb from `pathEditComb.ts` and the balance lines from
`pathEditBalance.ts` drawn under chrome-caps' `path-edit.comb` and
`path-edit.balance`, both off by default)

**Snapping** — `pathSnapSource` (`pathSnap/pathSnapSource.ts`) offers the
scene's path targets to the snap pipeline ([`docs/snapping.md`](../../../../../docs/snapping.md)).
`pathSnap/sceneIndex.ts` indexes what every node offers
(`pathSnap/snapGeometry.ts`: its drawn outline, or a text or image box), and
`pathSnap/glyphs.ts` holds the glyph and label the snap readout draws for each
kind. The targets — crossings, tangent and perpendicular points, midpoints,
extremes, quadrant points, nearest — are `findPathSnaps` in `@weasel-js/geom`
(`snap/`, over `intersect/`).

## Anchors are a view, not the storage

`pathToAnchors` / `anchorsToPath` convert between the command stream and the
anchor+handle model anchor editing works in. The command stream stays
canonical; the anchor list is a derived editing representation. Round-tripping
is expected to be lossless for paths the pen produced — if you add a command
form, check both directions.

`anchorEdits.ts` is the mutation vocabulary over that view: decode with
`editAnchorSet`, mutate, re-encode. Everything there is pure and knows nothing
about tools, Actions, or React, which is the point — the anchor-editing
Actions and their tests drive the same functions.

**Anchors are addressed by flat index**, the sequential position in walk order
across subpaths. That's what `enumerateAnchors` reports and therefore what the
dispatcher's `anchor:N` / `controlIn:N` / `controlOut:N` affordance kinds
carry. `anchorEdits` converts to `(sub, idx)` internally where subpath
structure matters. The two orders agree only because `pathToAnchors` and
`enumerateAnchors` walk the same stream and emit one anchor per M/L/C/Q — if
you touch either walker, `anchorEdits.test.ts` has the invariant test that
catches the divergence.

## Corner shape

`PolygonPath.corners` holds an optional `CornerSpec` per flat anchor index: a
shape and a radius, the setback along each edge. The shape is a CSS
`corner-shape` keyword or a `superellipse()` parameter k, and every keyword is
a point on k (`square` ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1,
`notch` -∞); `cornerShapePieces` (`@weasel-js/geom`, `paths/cornerShape.ts`)
draws any k. The command stream keeps the bare anchors, so editing still works
on them; `resolveCorners` (`paths/corners.ts`) expands the specs into plain
geometry, and the readers that draw, hit, bound, and export a path —
tessellation, `extractPolylines`, `flatSubpaths`, `boundsOfPath`, the booleans'
contour parser, the renderer's `drawPath`, and `serializePathD` — call it
first. A spec rides on its anchor through the anchor model (`PenAnchor.corner`),
so an insert or delete keeps each corner on its anchor. The widgets and
commands that edit corners in path edit are `@weasel-js/path-tools`'
`cornerShapePreset`.

## Constraints

A node's `data.constraints` is a list of `PathConstraint`s (`@weasel-js/geom`),
numbered by flat anchor index. The `editAnchors` dep makes them hold through
every path edit: `editOps` runs `constrainPathEdit` before it stores the path,
and renumbers the list through the edit's origins, so a delete or an insert
keeps each constraint on the anchors it named. The anchor drag calls the dep's
`constrainEdit` each frame, so the preview is what the commit will store; a
frame the constraints cannot hold in is dropped. A constraint that does not
hold when an edit starts conflicts with the rest: it is left out of the solve,
and the overlay draws its mark (`constraintGlyphs.ts`) in the conflict color.
`constrainAnchors` and `unconstrainAnchors` add and remove constraints on the
selected anchors through the dep's `setConstraints`. Horizontal and vertical
read a `data.path` node's rotation as their frame (`pathConstraints.ts`).

A click on a mark selects that constraint (the anchor selection and the
constraint selection exclude each other), and Delete removes it
(`deleteConstraint`). A solve that holds only by shrinking a named segment to a
point — horizontal and vertical on one segment — counts as a conflict.

A whole-shape transform — resize, rotate, flip — does not solve. It carries
the list unchanged: a rigid move keeps every constraint, a scale or a flip keeps
all but a set length (and, when non-uniform, equal lengths and angles off the
scale's axes), and a rotation of a `data.path` node turns the frame its
horizontal and vertical read. What a transform breaks is reported by
`constraintConflictsOf`, the same report a conflicting add gets, and later edits
leave it out of the solve.

The whole-path commands — Simplify, Offset, Trim segment, Extend to next path,
and the rest built on `pathCommands/pathNodes.ts` — rebuild the anchor list
without origins to renumber it through, so they drop the constraints, as they
drop a skin.

## Generated shapes

A drawn polygon or star keeps the parameters it was made from in
`data.generator`, beside `data.path` (`shapeGenerator.ts`). The path stays the
geometry everything reads; the generator only says how to make it again, which
the properties panel does through the entry's `settle` when Sides, Points or
Inner changes. Editing the path by hand turns the shape into plain geometry:
`editAnchors` drops the generator, and a generator whose path no longer matches
it is dropped on the next parameter change rather than overwriting the edit.

## Warps

A distorted, enveloped or puppet-warped path keeps the warp beside its geometry
in `data.warp` (`pathWarp.ts`): the unwarped source, the warp as data
(`PathWarp`, from `@weasel-js/geom`), the refit tolerance, and `frame`, the map
from the warp's own frame to where the node stores its path. The geometry is
still what every reader uses. Moving, resizing or rotating the node leaves the
stored path alone, so the warp stays valid without being rewritten; anything
that rewrites the path drops the warp, as it drops a generator, and a warp whose
result no longer matches the path is ignored. The tools are in
`tools/builtin/warp/`, the actions in `interactions/actions/warp/`.
