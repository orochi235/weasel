# Audit round 42 — area `cursor`

## haloFitsInBox and rotationFitsInBox ignore a stroke path's own width, so a stroked glyph whose halo is clipped passes both guards
- where: packages/cursor/src/types.ts:138 (haloFitsInBox), packages/cursor/src/types.ts:160 (rotationFitsInBox)
- scenario: both guards use `CURSOR_HALO_WIDTH / 2` (1.3) as the margin for every path. `paint.ts` `halo()` strokes a `stroke` path's halo at `p.width + CURSOR_HALO_WIDTH`, which reaches `(width + 2.6) / 2` from the path. Take `crosshair+rect` (or any crosshair mark): `markedGlyph` shifts the arms by (-3, -3), so the left arm starts at `M 1.6 9`. Its halo, round-capped at width 1.6 + 2.6, reaches x = 1.6 − 2.1 = −0.5, outside the viewBox, and the top arm does the same at y = −0.5. `haloFitsInBox` checks 1.6 ≥ 1.3 and returns true, so `glyphs.test.ts`'s "keeps its halo inside the viewBox" passes for a cursor whose halo is clipped. `brush` passes `rotationFitsInBox` with 9.9 ≤ 10.7, but its real halo extent is 9.9 + 2.1 = 12.0, the whole margin. A stroke of width ≥ 1.7 placed at that limit passes and gets sheared. The margin should be `(p.width + CURSOR_HALO_WIDTH) / 2` for `stroke` paths.
- evidence: read (arithmetic from GLYPHS.crosshair, mark slot shift [-3,-3], paint.ts halo widths)
- severity: medium

## A marked glyph is baked rotated, but its mark sits outside the inscribed circle and loses its corners
- where: packages/cursor/src/resolve.ts:76 (resolveCursor) / packages/cursor/src/bake.ts:74 (bakeCursor)
- scenario: `{ glyph: 'crosshair', mark: 'rect', angle: Math.PI / 4 }` resolves to the CSS tier and bakes a rotation about the box center in a viewBox that does not grow. The `rect` mark lands at 14.2–21.0 in both axes (slot 17.6, size 10). Its corner (21, 21) is 12.7 units from the center (12, 12), beyond the 10.7 that `rotationFitsInBox` allows and beyond the 12-unit half-box, so at 45° the mark's corner and halo fall outside the image and are clipped. `glyphs.test.ts` checks `rotationFitsInBox` only for unmarked ROTATABLE glyphs, and nothing refuses or adjusts an angle on a marked glyph. The fix is either to reject or ignore `angle` when `mark` is set, or to keep the mark upright and outside the rotation.
- evidence: read (geometry computed from GLYPHS/MARKS; not rendered)
- severity: low

## The cursorFor cache claims a bounded key space, but `size` and `fallback` are free-form, so it grows without limit
- where: packages/cursor/src/registry.ts:74 (cursorFor)
- scenario: the key includes the raw `size` (any finite positive double up to 128) and the raw `fallback` string. `brushRing(r, 'px')` rounds its size, but a consumer spec such as `{ glyph: 'crosshair', size: 16 * devicePixelRatio * zoom }`, or a slider-driven size, mints a new ~1–2 KB data-URI entry for every distinct value. The module-level `Map` is never evicted for the life of the page. The docstring's "handful of sizes … needs no eviction" holds only for callers that happen to use a few sizes. Either quantize the size in the key and in the bake (for example to whole px), or put an LRU cap on the cache.
- evidence: read
- severity: low

## A world-unit brush ring of radius 0 is drawn at the 24 px default, while a px ring of radius 0 is drawn at 1 px
- where: packages/cursor/src/brushRing.ts:13 (brushRing), with packages/cursor/src/resolve.ts:67
- scenario: `brushRing(0, 'px')` clamps to `size: 1`, and its comment says a brush too small to round "is not drawn at the default size". `brushRing(0, 'world')` returns `worldRadius: 0`. `resolveCursor`'s `positive()` drops that, so the spec falls through to the CSS tier with no size and bakes the 24 px default ring. A world brush shrunk to 0 (or a non-finite radius) therefore shows a large 24 px ring instead of a minimal one. The two units answer the same "too small" question in opposite ways.
- evidence: read
- severity: low

## walk() accepts absolute H, V, C, S, Q and T but reads them as x,y pairs, so the fit guards mis-measure instead of throwing
- where: packages/cursor/src/types.ts:124 (walk)
- scenario: the docstring says the dialect is `M`/`L`/`A`/`Z` and that a command outside it throws. Only lowercase commands throw, though. An absolute `H 20` falls into the "M and L" branch, where its single number never forms a pair (`i + 2 <= 1` is false), so it is skipped and the point (20, cy) is never measured. `M 2 12 H 23.5 V 12` therefore passes `haloFitsInBox` while the path reaches x = 23.5. `placeCursorPath` (mark.ts:36) throws for the same commands, so the two readers of the dialect disagree. walk should throw on any command outside M, L, A, and Z, as placeCursorPath does.
- evidence: read
- severity: low

## walk() bounds an arc whose radius is too small for its chord by the authored radius, not the radius SVG scales it up to
- where: packages/cursor/src/types.ts:103 (walk)
- scenario: SVG scales the radii up when `r < half-chord`, so the arc becomes a half circle of radius `half`. walk clamps `off` to 0 but keeps `r = max(rx, ry)` for the bounds. `M 2 12 A 1 1 0 0 1 22 12` draws a half circle of radius 10 reaching y = 2, but walk reports only x 1..23 and y 11..13. The guards then pass a glyph whose arc runs well into the halo margin. The fix is `r = Math.max(rx, ry, half)`.
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

<!-- done: 6 findings, files read: 12 -->
