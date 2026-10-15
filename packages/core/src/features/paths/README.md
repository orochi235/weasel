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
delete-with-refit, scissors, rect select) and the anchor model itself
(`pathToAnchors` / `anchorsToPath`, `PenAnchor`, `nearestSegmentT`). Its
invariant test, `anchorEdits.test.ts`, stays here because it reads an action's
anchor walker.

**Rendering** — `pathLayer.ts`, `markerCommands.ts` (marker heads as draw
commands; the ribbon, the marker registry and `strokeToPath` are in
`@weasel-js/stroke`), plus `penPreviewLayer.ts` (the pen's
in-progress path) and `pathEditingOverlayLayer.ts` (anchor-edit chrome)

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

## Dynamic corners

`PolygonPath.corners` holds an optional `CornerSpec` (`round`, `chamfer`, or
`inverted`, and a radius) per flat anchor index. The command stream keeps the
bare anchors, so editing still works on them; `resolveCorners`
(`@weasel-js/geom`, `paths/corners.ts`) expands the specs into plain geometry,
and the readers that draw, hit, bound, and export a path — tessellation,
`extractPolylines`, `flatSubpaths`, `boundsOfPath`, the booleans' contour
parser, the renderer's `drawPath`, and `serializePathD` — call it first. A
spec rides on its anchor through the anchor model (`PenAnchor.corner`), so an
insert or delete keeps each corner on its anchor. In path edit, each corner
anchor gets a widget (`cornerWidgets.ts`), hit as `corner:N` and dragged by
`editCornerAction`; `cycleCornerStyleAction` and `setCornersAction` change the selected corners'
style.

## Generated shapes

A drawn polygon or star keeps the parameters it was made from in
`data.generator`, beside `data.path` (`shapeGenerator.ts`). The path stays the
geometry everything reads; the generator only says how to make it again, which
the properties panel does through the entry's `settle` when Sides, Points or
Inner changes. Editing the path by hand turns the shape into plain geometry:
`editAnchors` drops the generator, and a generator whose path no longer matches
it is dropped on the next parameter change rather than overwriting the edit.
