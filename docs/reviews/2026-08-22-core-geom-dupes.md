# Core's private copies of geom code

For a weasel maintainer. `packages/core` carries its own copies of geometry
that also lives in `packages/geom`, and the copies drift. This records which
copy consumers actually execute, the two defects fixed in core's copies, why
the fix landed in core instead of delegating to `@weasel-js/geom`, and what
duplication is still there.

## Which copy runs

Nothing outside `packages/geom` imports `@weasel-js/geom/booleans`. The only
other reference in the repo is a path mapping in `packages/core/tsconfig.json`
that nothing uses. Core's boolean actions, the `boolean-ops` demo and
`apps/draw` all reach `pathUnion` and its siblings through `@weasel-js/core`,
which serves `packages/core/src/features/paths/booleans.ts`. The geom copy is
dead code today; a fix to it changes nothing that ships.

## What was fixed

**Holes were discarded.** `pathToMultiPolygon` ended with
`rings.map((r) => [r])`, making every contour its own polygon. `polygon-clipping`
unions the polygons of a MultiPolygon, so a donut arrived at the clipper as a
solid disc, and `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`,
`pathDivide` and `pathCrop` all returned a filled shape. The path's `fillRule`
was never read.

A comment claimed the clipper "re-classifies winding internally during the op,
so we don't need to pre-sort outer/hole rings." It does not — that is what the
bug was — and the comment is gone.

Contours are now grouped into the outer + holes form the clipper documents.
Rings are nested by containment; each region is classified per `fillRule`,
even-odd by nesting depth and non-zero by the winding summed along the ancestor
chain. A filled region emits one polygon carrying its unfilled children as
holes, an island inside a hole emits its own polygon, and a same-winding ring
nested inside a non-zero fill bounds nothing and is dropped.

Two limits worth knowing. Nesting is decided by a majority vote over three
sample vertices, so rings that touch exactly can be misclassified. Rings that
overlap without nesting fall back to a union — the outer/holes model cannot
express that case at all, and neither could the old code.

**Bezier flattening could not terminate.** The four flatteners in `flatten.ts`
stop when the control points' perpendicular distance to the chord falls at or
below `tolerance`. Neither side of that comparison was checked, and two inputs
made it unsatisfiable: a non-finite coordinate makes the distance `NaN`, and
every comparison against `NaN` is false; a tolerance of `0`, `NaN`, or a
negative number is never reached, not even by a collinear segment at distance
exactly `0`. Both are reachable from the public API — `pointInPath`,
`strokeHitTest` and the boolean adapter all flatten with a caller-supplied
tolerance, and a path can carry a `NaN` coordinate after a degenerate
transform. Each public function now validates once and hands off to a private
recursive helper: non-finite input emits the segment endpoint and stops, and a
non-positive or `NaN` tolerance is floored at `1e-6`.

## Why the fix is in core, not a delegation to geom

Core's `Path` is not the obstacle. `Path` is structurally assignable to geom's
`GeomPath` and `GeomPolygonPath` back to `PolygonPath`, with no conversion and
no copy — that was compiled to check, not assumed. Two other things blocked it.

Geom's copies carry the identical defects, because they are verbatim ports.
Delegating on this branch would have imported the bug and left the new tests
red; the geom fix lives on another branch and is not here.

Geom's boolean API is also a strict subset of what core exports. It has no
`pathCrop`, which core exports and `interactions/actions/booleans` calls, and
it does not export `pathToMultiPolygon` / `multiPolygonToPath`, which core's
own tests exercise. Geom's `curve.ts` has `flattenCubic` but no
`flattenQuadratic` and no arc-length variants, and core's barrel exports all
four. Delegating therefore means widening geom's public API — in the same
package another review is changing right now.

The unification is still the right end state. It wants to happen once the geom
fix has landed, as its own change, and it should carry `pathCrop`,
`flattenQuadratic` and the arc-length flatteners into geom rather than leaving
core with a rump copy.

## Still duplicated

Two copies of geom's `pointSegmentDist2` went in this change — one in
`hitTest.ts`, one in `pathDistance.ts` — because core already imports
`pointInPolygon` and `segmentsCross` from the same geom module, so the swap
carried no new dependency and no risk. Everything below is still there.

Roughly two thirds of geom's public surface has no importer in core.
`boundsOfCoords`, `unionBox`, `boxContainsPoint`, `rectToContour`,
`forEachSegment`, `cubicEvalAt`, `approxEq`, `EPS`, `sub`, `len2`, the whole
`mat3` constructor set, and the `PATH_*` constants are all exported and all
unused — core has its own copy of each.

The larger ones, roughly worst first:

- **`forEachSegment`.** Geom exports one; core re-writes the "walk `commands`,
  track `ci`, carry the pen" loop about a dozen times — `hitTest.ts` (twice),
  `bounds.ts`, `pathDistance.ts`, `tessellate/tessellate.ts`,
  `tessellate/polyline.ts`, `transform.ts` (twice), `poseRotation.ts`,
  `poseDescriptor.ts`, `booleans.adapter.ts`, `splitSubpaths.ts`. The payload
  differs each time; the pen bookkeeping is copied verbatim, and two copies get
  it wrong. `tessellate.ts` treats `PATH_Z` as a no-op instead of returning the
  pen to the subpath start, so `M … Z L …` tessellates from the wrong point.
  `pathDistance.ts` dispatches with an `if`/`else if` chain that has no `else`
  and no throw, so an unrecognized command leaves `ci` unadvanced and every
  later coordinate read is misaligned — silently.

- **`PATH_CMD_LENGTHS`.** Beyond geom's copy and core's own in
  `core/geometry/path.ts`, `transform.ts`, `poseRotation.ts` and
  `poseDescriptor.ts` each carry a byte-identical private `COORD_COUNT` map of
  the same five numbers. Indexing any of them with an unknown command yields
  `undefined`, `ci += undefined` is `NaN`, and writes at a `NaN` index are
  silent no-ops on a typed array — the function returns a path whose coordinate
  tail is zeros, with no throw.

- **`cubicEvalAt`.** Six independent Bernstein evaluations in core:
  `pathDistance.ts`, `anchors.ts`, `insertPathAnchor.ts`, `schneiderFit.ts`
  (three times), and `curves/bezierCubic.ts` + `curves/spiro.ts`, the last two
  byte-identical to each other. `elevateQuadraticToCubic` is likewise inlined
  in `pathDistance.ts` while `bounds.ts` imports geom's for the same job.

- **`pointInPolygon`.** `tessellate.ts`'s `pointInContour` is the same even-odd
  ray cast over a subrange, minus geom's `n < 3` guard. It decides which
  positive contour owns each hole from a single sample point — the failure mode
  this change's `ringContains` votes around, and the normal case for booleans
  output and font glyphs.

- **`rectToContour`.** Six inline copies. Not a blind swap: geom emits five
  vertex pairs with the first repeated, every core copy emits four with an
  implicit closing edge, and `tessellate/polyline.ts` depends on which.

- **`boxToBox`.** `poseDescriptor.ts` hand-rolls it and disagrees with geom on
  the degenerate axis — geom scales a zero-extent source by `1`,
  `poseDescriptor` by `0`, which collapses a flat path onto the destination
  origin. `scalePathToBounds` on the same path survives, because it goes
  through geom. `poseDescriptor.ts` and `transform.ts` document the same
  behavior and do different things; one of the two comments is wrong.

- **`mat3`.** The renderer's `renderer/math/mat3.ts` is a deliberate second
  representation (9-element column-major `Float32Array` for
  `uniformMatrix3fv`), and both files say so. Two traps regardless: its
  `invert` returns identity when the determinant is exactly zero where geom
  returns `null` below `1e-12`, so a near-singular matrix passes and produces
  entries around `1e16` that a `Float32Array` cannot hold — `gradientSpaceInverse`
  feeds that straight to `u_worldInv`. And its `translate`/`scale` share names
  with geom's but post-multiply an existing matrix where geom's construct a
  fresh one, so code moved between the layers compiles and misbehaves.

Two more defects the survey turned up that are not geom duplication but sit in
the same files. `pathHitTest.ts`'s `extractVertices` stops at the first `Z`, so
`pathContainsRect`, `pathIntersectsRect`, `pathContainsPolygon` and
`pathIntersectsPolygon` treat a donut as a solid disc — a marquee entirely
inside the hole reports as contained — and it throws outright on any bezier
command, reachable from ordinary marquee selection. Separately,
`polygonHitTestRect.ts` claims to match `pointInPath` and always answers
even-odd, so `pathContainsPoint` and `pathContainsRect` disagree on the same
`nonzero` path. Both want a decision about the rect/polygon kernel's contract,
not a patch.
