## brushRing draws a NaN or negative px radius at the default 24px instead of refusing it
- where: packages/cursor/src/brushRing.ts:20 (brushRing)
- scenario: `brushRing(NaN)` gives `size: NaN`; `brushRing(-3)` gives a negative `size` (the `Math.max(1, …)` floor only runs for `radius >= 0`). `resolveCursor` then reads either size as "not a finite positive number" and bakes the 24px default ring. The function refuses infinite radii specifically "rather than draw it at the default", and floors tiny positive radii at one pixel for the same reason, but a NaN or negative radius (e.g. a brush width slider mid-edit, or a computed radius gone NaN) silently shows a full-size 24px brush. It should either refuse (RangeError) or floor to the one-pixel ring as radius 0 does. In `'world'` units the same inputs (`radius !== 0`) become `worldRadius: NaN`/negative, which `resolveCursor` drops, so the result is again a fixed 24px CSS ring rather than a world-following one.
- evidence: read
- severity: low

## A finite worldRadius whose drawn size overflows is accepted, where the px path refuses the same overflow
- where: packages/cursor/src/brushRing.ts:17 (brushRing); packages/cursor/src/resolve.ts:71 (resolveCursor); packages/cursor/src/paint.ts:116 (worldCursorPx)
- scenario: `brushRing(1e308, 'px')` throws because `(radius * 24) / 9.9` overflows to Infinity. `brushRing(1e308, 'world')` returns `{ worldRadius: 1e308 }`, `resolveCursor` accepts it (it only rejects `worldRadius === Infinity`), and `worldCursorPx` then returns `1e308 * scale * (24 / 9.9)` = Infinity at any scale ≥ 1, so the painter is handed an infinite size (an Infinity/NaN matrix from `cursorPaintMatrix`). The overflow check the px path makes is answered differently on the world path; it should either refuse there too or `worldCursorPx` should guard a non-finite result.
- evidence: read
- severity: low

## The fit guards reject a circular arc written with a negative radius as "elliptical"
- where: packages/cursor/src/types.ts:121 (walk)
- scenario: SVG takes the absolute value of arc radii, so `A -3 3 0 1 0 …` is a circle of radius 3. `walk` compares `rx !== ry` before taking `Math.abs`, so a glyph passed to `haloFitsInBox` / `rotationFitsInBox` (both exported, and `rotationFitsInBox` runs inside `bakeCursor` via `rotationStep` for any turned glyph) throws "has an elliptical arc (-3 by 3)". The comparison should be on `Math.abs(rx) !== Math.abs(ry)`, matching the `Math.abs(rx)` used two lines later.
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

<!-- done: 3 findings, files read: 12 -->
