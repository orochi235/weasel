# Audit round 85, area `cursor`

## Fit guards ignore a stroke path's own width, so a stroke whose halo is clipped passes
- where: packages/cursor/src/types.ts:146 (haloFitsInBox), packages/cursor/src/types.ts:166 (rotationFitsInBox)
- scenario: a `stroke` path's halo is drawn at `(p.width + CURSOR_HALO_WIDTH)` wide (paint.ts `halo`), so it reaches `(w + 2.6) / 2` past the path. Both guards hold every point to only `CURSOR_HALO_WIDTH / 2` (1.3) from the edge. A stroke of width 2.8 (the `rotate` glyph's weight) whose end sits at x = 1.5 passes `haloFitsInBox`, yet its halo reaches x = −1.2 and is clipped by the viewBox; same for `rotationFitsInBox` against the inscribed circle. Should add `p.width / 2` for `stroke` (and `detail`) roles.
- evidence: read
- severity: medium

## rotationFitsInBox measures an arc by its bounding square's corners, rejecting arcs that fit at every angle
- where: packages/cursor/src/types.ts:110 (walk), packages/cursor/src/types.ts:166 (rotationFitsInBox)
- scenario: `walk` reports an arc as the four corners of its circle's bounding square. That is a sound bound for the axis-aligned `haloFitsInBox`, but `rotationFitsInBox` takes `hypot` from the box center, and a corner lies `r·(√2 − 1)` farther out than the circle does. A centered ring of radius 9.5 in a 24 box (true extent 9.5 + 1.3 = 10.8 → say radius 9) reports corners at 9·√2 ≈ 12.7 > 10.7 and returns false, though the ring is rotation-invariant. The furthest point from center is `hypot(ox − c, oy − c) + r`, not a corner.
- evidence: read
- severity: low

## walk under-reports an arc whose radius is too small for its chord
- where: packages/cursor/src/types.ts:117 (walk)
- scenario: SVG scales `r` up to half the chord when it is too small (F.6.6). `walk` clamps `off` to 0 but keeps the authored `r`, so `M 2 12 A 1 1 0 0 1 22 12` (drawn as a radius-10 half circle) is bounded as a radius-1 circle around (12, 12), and both fit guards pass a glyph that is drawn to the box edge.
- evidence: read
- severity: low

## cursorFor's cache is keyed on raw size and fallback with no bound
- where: packages/cursor/src/registry.ts:69 (cursorFor)
- scenario: the comment says the key space is bounded by "the handful of sizes and fallbacks in use", but `size` is any finite double ≤ 128 and `fallback` any string. `resolveCursor` calls `cursorFor` on every resolve (the hover pump runs it per pointermove), so a spec whose `size` follows a continuous value (a zoom-derived px size, an animated size) adds one baked data URI per distinct value, forever. Needs quantizing the size or a capped cache.
- evidence: read
- severity: medium

## resolveCursor validates glyph and mark on the CSS tier only
- where: packages/cursor/src/resolve.ts:66 (resolveCursor)
- scenario: `{ glyph: 'pencil', mark: 'rect' }` (pencil has no slot) or an unknown glyph name from untyped JS throws in `resolveCursor` through `cursorFor` → `cursorGlyph`. The same spec with `worldRadius: 5` or `size: 200` resolves to a painted cursor without complaint, and fails only later in the painter's draw. One question (is this spec drawable) answered two ways by tier; the painted arms should run the same `cursorGlyph` check.
- evidence: read
- severity: low

## A CSS cursor written to one element is left behind when the sink's element changes
- where: packages/cursor/src/cursorSink.ts:55 (createCursorSink write)
- scenario: `target.element()` is reread at each write. Set an override while it returns element A (A gets the override's cursor, `wroteOverride = true`), the surface remounts so it returns B, then `setOverride(null)`: the clear is written to B and A keeps the override cursor (or `'none'` from a painted one, leaving no cursor at all if A is reused). The sink tracks that it wrote but not where.
- evidence: read
- severity: low

## bakeCursor writes accent fills, stroke colors and path data into SVG attributes unescaped
- where: packages/cursor/src/bake.ts:46 (renderOp)
- scenario: `bakeCursor` is public and takes any `CursorGlyph`. An `accent` path with `fill: 'url("#g")'` or any value holding `"` closes the attribute early; the SVG is malformed, the browser rejects the image and the cursor silently falls back to the keyword. Attribute values need `"`/`&`/`<` escaped.
- evidence: read
- severity: low

## An empty fallback bakes an invalid cursor declaration
- where: packages/cursor/src/bake.ts:91 (bakeCursor)
- scenario: `opts.fallback ?? 'default'` keeps `''`, giving `url("…") 12 12, ` — a trailing comma with no keyword, which is invalid CSS, so assigning it to `style.cursor` is ignored and the previous cursor stays. `resolveCursor({ glyph: 'pen', fallback: '' })` reaches this. Should treat a blank fallback as the default.
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

<!-- done: 8 findings, files read: 12 -->
