## A sink's painted override does not put back the override it replaced, though its element write does
- where: packages/cursor/src/cursorSink.ts:80 (createCursorSink, writePainted)
- scenario: before any `setBase`, other code has `painted.setOverride(X)` on the shared state. The sink's `setOverride(cursorY)` writes `painted.setOverride(Y)` (or `'none'` for a CSS override); `setOverride(null)` then writes `painted.setOverride(null)`, so X is gone and the base shows. The element path in the same function records `prior` and restores it unless overwritten since; the doc ("an override is written and later removed, putting back the cursor it replaced unless other code has written one since … a cursor some other code put on the element or the painted state is otherwise left alone") promises the same for the painted state. Two places answer "what does clearing the override restore" two ways.
- evidence: read
- severity: low

## `bakeFallback` refuses valid cursor lists whose images are `image-set(…)` or whose hotspot uses an exponent or `+`
- where: packages/cursor/src/bake.ts:41 (IMAGE_ENTRY / bakeFallback)
- scenario: `fallback: 'image-set("a.png" 1x) 4 4, auto'` or `'url(a.png) 1e1 2, auto'` / `'url(a.png) +4 4, auto'` are valid CSS `cursor` values, but IMAGE_ENTRY matches only `url(…)` with `-?\d*\.?\d+` hotspots, so the remainder is not a keyword and `bakeCursor`/`cursorFor`/`resolveCursor` throw a RangeError for a fallback the browser would accept. The doc says only values that do not end a cursor value "that way" throw.
- evidence: read
- severity: low

## `brushRing(r, 'world')` with a huge finite radius is accepted, and its painted size overflows to Infinity at draw
- where: packages/cursor/src/brushRing.ts:16 (brushRing), packages/cursor/src/paint.ts:121 (worldCursorPx)
- scenario: `brushRing(1e308, 'world')` returns `{ worldRadius: 1e308 }`; `resolveCursor` accepts it as painted; `worldCursorPx(glyph, 1e308, 2)` computes `1e308 * 2 * (24/9.9)` = Infinity, and `chromeLineWidthScale` then gives 0, so the painter is handed an infinite size. The px unit refuses a radius whose size overflows (unruled 2026-11-25, audit 88); the world unit has no counterpart, either at spec time or in `worldCursorPx`.
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
