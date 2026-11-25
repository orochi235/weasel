# Audit round 85 — area `cursor`

## The fit guards ignore a stroke path's own width, so a stroke whose halo is clipped passes
- where: packages/cursor/src/types.ts:139 (haloFitsInBox), packages/cursor/src/types.ts:161 (rotationFitsInBox)
- scenario: both guards test each authored point against a margin of `CURSOR_HALO_WIDTH / 2` (1.3). A `stroke` path's halo is painted at `width + CURSOR_HALO_WIDTH` (paint.ts:39), so it reaches `(width + 2.6) / 2` past the point; a `detail`/`stroke` ink line reaches `width / 2`. A stroke glyph with `width: 2.8` (as `rotate` has) and a point at 1.4 from the edge passes `haloFitsInBox`, yet its halo extends 2.7 and is clipped by 1.3 units. The guards should widen the margin by half the path's own width for `stroke` (and `over` stroke) paths.
- evidence: read
- severity: medium

## Clearing an override on a sink that does not own the base erases the cursor other code had set
- where: packages/cursor/src/cursorSink.ts:65 (createCursorSink → write)
- scenario: element has `style.cursor = 'grab'` set by other code; `setOverride(css 'move')` writes `'move'`; `setOverride(null)` writes `''`. The element is left with no cursor instead of `'grab'`. The doc says a cursor other code put on the element is left alone, but the value overwritten by the override is never saved and restored.
- evidence: read
- severity: medium

## An override written to one element is never cleared once `element()` returns a different one
- where: packages/cursor/src/cursorSink.ts:57 (createCursorSink → write)
- scenario: `target.element` is read at each write. Override set while it returns element A (A gets the override cursor). The surface remounts and `element()` now returns B; `setOverride(null)` writes only to B, so A keeps the stale override cursor forever. `wroteOverride` tracks a flag, not the element written to.
- evidence: read
- severity: low

## `brushRing(r, 'world')` with r = 0 draws a 24 px baked ring, while `brushRing(0, 'px')` draws a 1 px ring
- where: packages/cursor/src/brushRing.ts:13 (brushRing), packages/cursor/src/resolve.ts:64 (resolveCursor)
- scenario: world unit returns `{ worldRadius: 0 }`; `resolveCursor`'s `positive()` drops 0, so the spec falls to the CSS tier with no size and bakes at the default 24 px. The px path was ruled (unruled.md, 2026-11-10) to give a radius of 0 or more at least one pixel rather than the default 24; the world path answers the same question the opposite way. A zero-radius world brush (or one zoomed to tiny) shows a large ring.
- evidence: read
- severity: low

## Baked hotspot can equal the image width, outside the image
- where: packages/cursor/src/bake.ts:83 (bakeCursor → pixel)
- scenario: `pixel` clamps to `Math.floor(size)`, but valid hotspot coordinates are `0 … width − 1`. `brushRing(0)` gives size 1; the brush hotspot 12/24·1 = 0.5 rounds to 1, so `url(...) 1 1` names a point outside a 1 px image, which browsers treat as invalid / misplace. The clamp should be `Math.max(0, Math.ceil(size) - 1)` (or similar).
- evidence: read
- severity: low

## Arc bounds in the fit guards use the authored radius even when SVG scales it up
- where: packages/cursor/src/types.ts:104 (walk)
- scenario: when an arc's radius is smaller than half its chord, SVG renders it with the radius scaled up to half the chord; `walk` clamps `off` to 0 but keeps `r`, so the bounding square it reports is smaller than the drawn circle. `A 1 1 0 0 1 20 12` from (4, 12) draws a radius-8 half circle but is measured as radius 1, so `haloFitsInBox`/`rotationFitsInBox` can pass a glyph that clips. Use `r = Math.max(r, half)`.
- evidence: read
- severity: low

## `walk` does not return the current point to the subpath start on `Z`
- where: packages/cursor/src/types.ts:101 (walk)
- scenario: after `Z`, SVG's current point is the subpath's initial `M` point; `walk` leaves `cx, cy` at the last vertex. An `A` (or implicit continuation) directly after `Z` has its circle center computed from the wrong start, so the guards measure a different arc than the one drawn.
- evidence: read
- severity: low

## `renderOp` and `bakeCursor` interpolate unescaped strings into SVG and CSS
- where: packages/cursor/src/bake.ts:47 (renderOp), packages/cursor/src/bake.ts:89 (bakeCursor)
- scenario: an `accent` path's `fill` (a consumer-authored glyph passed to the public `bakeCursor`) such as `url("#a")` or containing `"` closes the attribute and yields malformed SVG, so the browser rejects the image and falls back silently. `fallback` is likewise dropped verbatim after the comma, so a value like `pointer; color: red` corrupts the declaration.
- evidence: read
- severity: low

## `cursorFor`'s cache is unbounded for continuous sizes or arbitrary fallbacks
- where: packages/cursor/src/registry.ts:72 (cursorFor)
- scenario: the key embeds the raw `size` and `fallback`. The doc claims "the handful of sizes … in use", but `resolveCursor` passes any positive fractional `size` through untouched (only `brushRing` rounds), so a caller sizing a cursor from a zoom or a measured value adds a new entry (a full data-URI string) on every distinct value, forever, with no eviction.
- evidence: read
- severity: low

## Files read
packages/cursor/src/bake.ts
packages/cursor/src/brushRing.ts
packages/cursor/src/cursorSink.ts
packages/cursor/src/glyphs.ts
packages/cursor/src/index.ts
packages/cursor/src/mark.ts
packages/cursor/src/paint.ts
packages/cursor/src/paintedCursorState.ts
packages/cursor/src/pbt.fixture.ts
packages/cursor/src/registry.ts
packages/cursor/src/resolve.ts
packages/cursor/src/types.ts

<!-- done: 9 findings, files read: 12 -->
