# paths

The kit's vector-geometry primitive. `Path` is the canonical shape type — it
replaced the per-shape ad-hoc poses, so rect, ellipse, polygon, star, line, pen
output, and boolean results are all the same type.

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

**Construction**
`builder.ts` (`PathBuilder`, `rectPath`, `ellipsePath`, `regularPolygonPath`,
`starPath`, `linePath`, `polygonFromPoints`), `pathFromD.ts` (parse SVG `d`).

> **Path language stance:** external/terse geometry is expressed as SVG path
> data via `pathFromD` — the kit does not define a bespoke path DSL. Builders
> are a co-equal choice, not a lesser one. See `docs/conventions.md`.

**Query** — `bounds.ts`, `hitTest.ts` (`pointInPath`, `strokeHitTest`),
`pathHitTest.ts`, `pathDistance.ts`, `unionBoundsPath.ts`. The polygon-vs-rect
kernel `pathHitTest.ts` builds on lives in `core/geometry/polygonHitTestRect.ts`
— `core/adapters/arrayAdapter.ts` needs it too, and core may not import from
here.

**Transform** — `transform.ts`, `transformPath.ts`, `pathInWorld.ts`,
`poseRotation.ts`, `poseDescriptor.ts`, `originProjection.ts`

**Editing** — `anchors.ts` (`pathToAnchors` / `anchorsToPath`, `PenAnchor`,
`nearestSegmentT`), `anchorEdits.ts` (the anchor-set mutations: translate,
handle-drag with smooth mirroring, insert-on-segment, delete-with-refit,
scissors, rect select), `cubicMath.ts` (`splitCubicAtT`,
`fitCubicThroughDeletion`), `schneiderFit.ts` (curve fitting for freehand),
`splitByLine.ts`, `splitSubpaths.ts`, `compose.ts`

**Booleans** — `booleans.ts` + `booleans.adapter.ts` (union / intersect /
exclude / minus-front)

**Rendering** — `pathLayer.ts`, `markers.ts`, `flatten.ts`, `tessellate/`,
`curves/`, plus `penPreviewLayer.ts` (the pen's in-progress path) and
`pathEditingOverlayLayer.ts` (anchor-edit chrome)

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
