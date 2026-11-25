# Audit round 42 — area `cursor`

## The fit guards measure every path's halo as half the halo width, so a stroke path's halo can leave the box unseen — and the marked crosshair's does
- where: packages/cursor/src/types.ts:137 (haloFitsInBox), packages/cursor/src/types.ts:158 (rotationFitsInBox)
- scenario: both guards use a margin of `CURSOR_HALO_WIDTH / 2` (1.3) for every path, but `paint.ts`'s `halo()` strokes a `stroke`-role path at `width + CURSOR_HALO_WIDTH`, so its round-capped halo reaches `(width + 2.6) / 2` past the centerline: 2.1 for the crosshair's 1.6-wide arms. `cursorGlyph('crosshair', { mark })` shifts the glyph by `[-3, -3]`, putting the left arm's endpoint at x = 1.6 and the top arm's at y = 1.6. The guard sees 1.6 ≥ 1.3 and passes (the `glyphs.test.ts` "keeps its halo inside the viewBox" case for every crosshair+mark passes), but the halo cap extends to x = −0.5 and y = −0.5, and the viewBox clips it. Every marked crosshair (`rect`, `ellipse`, `line`, …, the shape tools' cursors) ships with its left and top halo caps shaved off. The guards should add each stroke/detail path's own `width / 2` to the margin.
- evidence: read (geometry computed by hand from GLYPHS.crosshair, mark.shift and paint.ts halo widths)
- severity: medium

## A marked glyph accepts an angle but is never checked for rotation, and the crosshair's marks fall outside the box when rotated
- where: packages/cursor/src/resolve.ts:63 (resolveCursor), packages/cursor/src/registry.ts:68 (cursorFor)
- scenario: `resolveCursor({ glyph: 'crosshair', mark: 'rect', angle: Math.PI / 4 })` bakes the marked glyph rotated about the box center. The `rect` mark's far corner sits at (21, 21), 12.7 units from the center (12, 12), against a rotation limit of 10.7 (`rotationFitsInBox`). At 45° that corner lands at about (12, 24.7), outside the 24-unit viewBox, so the mark's corner and its halo are clipped. `glyphs.test.ts` runs `rotationFitsInBox` only on `ROTATABLE = ['resize', 'rotate']`, and nothing refuses or warns on an angle given with a mark (or with `pen`, `pencil`, `eyedropper`, `swap`, which also fail the rotation guard, e.g. swap's (3, 6) is 10.8 from center).
- evidence: read
- severity: low

## The bake cache's key takes any size and any fallback string, so it is unbounded despite its comment
- where: packages/cursor/src/registry.ts:68 (cursorFor)
- scenario: the key is `name+mark|size|step|fallback`, with `size` any finite number up to 128 (fractional allowed, `bakeSize` passes 23.7 through) and `fallback` any string. A caller that derives a fixed CSS size from a continuous value — `{ glyph: 'brush', size: radius * zoom }`, or a size animated by a slider — mints a new ~1 KB data-URI entry for every distinct float, and the module-level `cache` Map never evicts. The comment's "handful of sizes … in use, so the cache needs no eviction" holds only for integer sizes; `brushRing` rounds, but `CursorGlyphSpec.size` and `cursorFor` do not. Either quantize the size in the key or bound the map.
- evidence: read
- severity: low

## The fit guards' path walk accepts absolute H, V, C, Q, S and T without throwing, and mis-measures H and V
- where: packages/cursor/src/types.ts:92 (walk)
- scenario: `walk` throws only on a lowercase (relative) command, on the stated ground that a relative command "would be measured as if absolute and silently under-report". Absolute `H`/`V` take one number, so the pair loop (`i + 2 <= nums.length`) visits nothing and leaves `cx`/`cy` stale: a glyph `M 12 12 H 23.5 V 12 Z` passes `haloFitsInBox` though x = 23.5 is past the 22.7 margin, and a following `A` computes its center from the wrong start point. `placeCursorPath` in mark.ts throws on exactly these commands, so the two readers of the same dialect disagree about what it is. `walk` should throw on any command outside `M`/`L`/`A`/`Z`.
- evidence: read
- severity: low

## The arc bound uses the authored radius even when SVG scales it up, under-reporting an arc whose radius is shorter than half its chord
- where: packages/cursor/src/types.ts:103 (walk)
- scenario: for `A r r 0 0 1 x y` with `r < |chord| / 2`, SVG (and Path2D) scale the radius up to `|chord| / 2`. `walk` clamps `off` to 0, so it centers the circle on the chord midpoint correctly but still bounds it by the authored `r`, not by `half`. For `M 2 12 A 1 1 0 0 1 22 12`, the drawn half-circle has radius 10 and reaches y = 2, but the guard reports y in [11, 13] and passes a glyph whose halo is clipped. `r` should be `Math.max(rx, ry, half)`.
- evidence: read
- severity: low

## markedGlyph drops a glyph's own `over` layer instead of keeping and shifting it
- where: packages/cursor/src/mark.ts:50 (markedGlyph)
- scenario: `CursorGlyph.over` is public glyph surface, and `markedGlyph` is exported for custom glyphs. For a glyph with a slot and its own `over` paths, `{ ...rest, over: mark.paths.map(...) }` replaces those paths with the mark's. They disappear from the marked cursor. The `paths` get `shift` applied, but the glyph's `over` paths are neither shifted nor kept. They should be shifted like `paths` and prepended to the mark's layer.
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
