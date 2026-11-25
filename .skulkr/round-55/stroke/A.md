# Audit round 55 — area `stroke` (blind reviewer)

Note: the brief names frozen commit bfc55709b4b1…, which `git` here does not know (`bad object`); the tree read is
HEAD 830b463cc1, with no working-tree changes under `packages/stroke`.

## nearestStrokeEdge reads per-vertex widths by the corner-resolved path's anchor numbers without remapping them, so on a path with `corners` its edge is not the drawn one
- where: packages/stroke/src/strokeEdge.ts:71-72 (nearestStrokeEdge)
- scenario: a polygon path with a rounded corner spec (`corners`) on anchor 1 and `stroke.vertexWidths = [w0, w1, w2, w3]`.
  `extractPolylines` resolves the corners (geom `tessellate/polyline.ts:45`), so the polylines' `anchorA/B` number the
  *expanded* path's anchors (the rounded corner adds one). `populateWidths(pl, vw, …)` then reads `vw[anchor]` with
  those numbers, so every anchor after the corner takes the next anchor's width (and the last reads past the array, falling
  back to the stroke width). `tessellateStroke` (`tessellate/stroke.ts:133-136`) instead runs `resolveCornersWithSources`
  and `remapPerAnchor` before populating. So the hit-test/drag edge an editor gets sits at a different distance from the
  path than the ribbon drawn for the same stroke, past the first rounded corner. Should remap the widths as
  `strokePolylines` does (or call it).
- evidence: read
- severity: medium

## A trim drops zero-length subpaths (round/square-capped dots) that the untrimmed stroke draws, and the clip-ribbon path still draws them
- where: packages/stroke/src/trim/windowPolylines.ts:39-42 (windowPolylines); packages/stroke/src/trim/clipRibbon.ts:125-137 / clipWindow.ts
- scenario: path `M0 0 L100 0 M50 50 Z` (or `M50 50 L50 50`), `cap: 'round'`. Untrimmed, `tessellateStroke` → `expandPolyline`
  → `emitDot` draws a dot at (50,50). Set `stroke.trim = {}` (documented in `resolveTrim` as "the whole of it") or any window
  covering the subpath: `windowPolylines` computes `total = 0`, `hi - lo <= EPS` and `continue`s before its "closed and
  covered whole" check, so the dot's run is gone — no dot, and `markerPlacements`' `headRuns` drops the markers sitting on
  it too. Meanwhile `clipRibbon` builds the dot (closed → `CLIP_WHOLE`, open → `CLIP_OPEN` with its length) and
  `clipWindow`'s window covers it, so the renderer's clip-ribbon path draws it. The same trimmed stroke shows the dot or
  not depending on which mesh path the renderer takes, and adding a whole-path trim changes what an untrimmed stroke draws.
  A run inside the window with no length should be kept whole (as `tessellateStroke` keeps it untrimmed).
- evidence: read
- severity: medium

## Miter joins fall back to bevel at small scales: the parallel test compares an unnormalized cross product against an absolute 1e-9
- where: packages/stroke/src/tessellate/ribbon.ts:301-306 (lineLineIntersect), called from emitJoin:186
- scenario: `denom = adx*bdy - ady*bdx` uses the raw segment vectors, so it is `|a|·|b|·sinθ`. Two segments 3e-5 units
  long meeting at 90° give `denom ≈ 9e-10 < 1e-9` → `null` → bevel, though the miter is well inside the limit. A path
  authored in small world units (or a fine polyline) and viewed zoomed in draws bevelled corners where `join: 'miter'`
  asks for miters, and the outcome changes with the path's scale alone. The test should be on the sine (normalize by the
  lengths) or relative to `|a|·|b|`.
- evidence: read
- severity: low

## The unknown-marker warning set grows without bound and never re-warns
- where: packages/stroke/src/markerHeads.ts:155-164 (warnUnknownMarker)
- scenario: `warnedMarkers` is a module-level `Set<string>` keyed by whatever `markerStart/Mid/End` names in document
  data; every distinct unknown key is kept for the process lifetime (also in production, where `isDev()` is false and
  nothing is even printed — the key is still added). A long-lived editor loading documents with many distinct bad keys
  (or a key typed character by character into a marker field) accumulates them. Adding only under `isDev()`, or bounding it,
  would fix the growth.
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

<!-- done: 4 findings, files read: 31 -->
