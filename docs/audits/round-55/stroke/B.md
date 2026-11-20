I couldn't write `.skulk/out/findings.md`: after the first save, writes to it were refused. So the file on disk holds only an early copy of finding 1, and the full document is below. A scratch script I made, `.skulk/out/probe.ts`, is still there because deleting it also needed approval. It was never run, so every finding is from reading the code.

# Audit round 55 — area `stroke` — findings

## A trimmed stroke with a `nib` (or `vertexWidths` under a metric) cuts at the wrong place: splitting corners in two breaks how the trim finds its segment
- where: packages/stroke/src/tessellate/nib.ts:55 (applyNib), packages/stroke/src/tessellate/vertexWidths.ts:67 (populatePolylineWidths, `scale` branch); read by packages/stroke/src/tessellate/stroke.ts:80 (tessellateStroke → windowTrim) and packages/stroke/src/trim/clipWindow.ts:46 (clipWindow, via clipRibbon's subpaths)
- scenario:
  - `strokePolylines` runs `populateWidths` before the trim window is applied. `applyNib`, and `populatePolylineWidths` when given a `scale`, split every corner into two points at the same place. Both copies carry anchorA === anchorB and anchorT 0.
  - `windowPolylines` places the trim's `CurvePosition` with `polylineAtCurve`. Its `anchorIndices` counts every such point as an anchor, so segment k maps to the wrong pair of points.
  - Example: path `M0 0 L10 0 L10 10`, nib `{ angle: 0.3, ratio: 0.5 }`, `trim: { start: 0.75 }`. The cut should be segment 1 at t 0.5, i.e. (10,5).
  - With the nib, the anchors are [p0, p1in, p1out, p2], so "segment 1" is the zero-length span p1in→p1out. The cut lands at (10,0), length 10, and half the path is drawn instead of a quarter.
  - The curve control lookup (`run.controls[k]`), `measuredPhase` and the dash phase are off by the same shift.
  - Marker heads trim the polylines without the nib, so they cut in the right place and no longer meet the line.
  - Without the nib, the same trim cuts correctly.
- evidence: read (nib.ts:49-60; geom/src/tessellate/atCurve.ts:29-44, :48; no test combines `nib` with `trim`)
- severity: medium

## `nearestStrokeEdge` doesn't remap `vertexWidths` onto the corner-resolved path, so on a path with `corners` it measures different widths than the ribbon draws
- where: packages/stroke/src/strokeEdge.ts:71-72 (nearestStrokeEdge)
- scenario:
  - `extractPolylines(path)` expands `path.corners`, which adds anchors at each cut corner and renumbers the anchors.
  - `strokePolylines` (stroke.ts:133-136) maps the widths onto the new numbering with `remapPerAnchor(given, anchorSources, 1)`. `nearestStrokeEdge` passes the raw `stroke.vertexWidths` to `populateWidths`.
  - On a rounded-corner polygon with per-vertex widths, every anchor after the first rounded corner reads the wrong entry, or one past the end, which falls back to the stroke width.
  - So the edge an editor hit-tests and drags disagrees with the drawn ribbon. Without `corners` the two agree.
- evidence: read (geom/src/paths/corners.ts:132, :152; geom/src/tessellate/polyline.ts:45)
- severity: medium

## `tessellateStroke` shifts a rect for inner/outer alignment even where `ribbonAligns` promises a centered ribbon (a metric that rotates the rect), and uses a metric-space width in world space
- where: packages/stroke/src/tessellate/stroke.ts:123-127 (strokePolylines) vs :152-158 (ribbonAligns)
- scenario:
  - With `metric.q !== 0`, `rectIntoMetric` returns null, so the world rect is used, but the alignment shift still runs. Its `width` is in metric units.
  - `ribbonAligns` returns false for the same input, and its doc tells the caller it gets a centered ribbon to cut to its side.
  - A direct caller following that gets a ribbon already shifted inward, which the cut keeps whole. The ink is w wide instead of w/2, and the shift is also wrong under the stretch.
  - The renderer escapes this only because `doubledStroke` (renderer/src/draw/pathPaint.ts:227) forces `align: 'center'`.
- evidence: read
- severity: low

## Miter joins on short segments fall back to bevel, because `lineLineIntersect`'s parallel test is an absolute 1e-9 on unnormalized vectors
- where: packages/stroke/src/tessellate/ribbon.ts:305-306 (called from emitJoin :186)
- scenario:
  - The test value is |a|·|b|·sinθ, with the raw segment vectors.
  - Two 3e-5-long segments meeting at 90° give 9e-10, below the threshold, so the join bevels.
  - So a world-width stroke on a small-unit path, viewed at high zoom, bevels every miter corner that `join: 'miter'` and the miter limit should draw.
- evidence: read
- severity: low

## `clipRibbon` keeps subpaths a fixed 1-unit gap apart but stores lengths in float32, so long paths lose the separation
- where: packages/stroke/src/trim/clipRibbon.ts:97,100,142
- scenario:
  - Subpaths sit `gap = 1 + 2(si+ei)` apart, with `margin = gap/4`, and every length goes into a Float32Array.
  - Past roughly 4e6 total length (for example, a long route in metres), float32 steps are 0.25–1, the same size as the margin and the gap.
  - Then a window can't tell one subpath's end from the next one's start, and a closed subpath can show the wrong build or bleed into its neighbor.
- evidence: read
- severity: low

## Files read
packages/stroke/src/index.ts
packages/stroke/src/markerHeads.ts
packages/stroke/src/markerInset.ts
packages/stroke/src/markerSites.ts
packages/stroke/src/offsetPath.ts
packages/stroke/src/pbt.fixture.ts
packages/stroke/src/strokeAtScale.ts
packages/stroke/src/strokeEdge.ts
packages/stroke/src/strokeMarkerShapes.ts
packages/stroke/src/strokeMarkers.ts
packages/stroke/src/strokeToPath.ts
packages/stroke/src/tessellate/dash.ts
packages/stroke/src/tessellate/expandPolyline.ts
packages/stroke/src/tessellate/flattening.ts
packages/stroke/src/tessellate/innerJoins.ts
packages/stroke/src/tessellate/insets.ts
packages/stroke/src/tessellate/metric.ts
packages/stroke/src/tessellate/nib.ts
packages/stroke/src/tessellate/ribbon.ts
packages/stroke/src/tessellate/ribbonWindow.ts
packages/stroke/src/tessellate/stroke.ts
packages/stroke/src/tessellate/vertexWidths.ts
packages/stroke/src/test-seams.ts
packages/stroke/src/trim/clipRibbon.ts
packages/stroke/src/trim/clipWindow.ts
packages/stroke/src/trim/resolveTrim.ts
packages/stroke/src/trim/trimPathEnds.ts
packages/stroke/src/trim/trimSpan.ts
packages/stroke/src/trim/trimmedPath.ts
packages/stroke/src/trim/windowPolylines.ts
packages/stroke/src/wideStrokeUnion.bench.ts

<!-- done: 5 findings, files read: 31 -->