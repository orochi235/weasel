# cursor findings

## brushRing draws a negative or NaN radius as the default 24px ring
- where: packages/cursor/src/brushRing.ts:15-21 (brushRing)
- scenario: `brushRing(-0.1)` → size `Math.round(-0.24)` = -0; `brushRing(-5)` → size -12; `brushRing(NaN)` → size NaN; `brushRing(-5, 'world')` / `brushRing(NaN, 'world')` → `worldRadius` -5 / NaN. `resolveCursor` reads every one of those as "not a finite positive number" and bakes the 24px default ring, which the function's own comment says it should not ("a brush too small to round to one is not drawn at the default size"), and it only refuses ±Infinity. A brush slider that goes slightly negative or produces NaN shows a large wrong-size ring. It should either throw (as it does for Infinity) or clamp to the one-pixel ring.
- evidence: read
- severity: low
- fix: packages/cursor/src/brushRing.ts
- size: line
- cause: only ±Infinity guarded; sign kept for negative sizes
- confidence: sure

## A painted override set by the sink is cleared to null, not given back, unlike the element side
- where: packages/cursor/src/cursorSink.ts:79-87 (writePainted), doc at 41-48
- scenario: a sink that does not own the base (no `setBase` yet) calls `setOverride(x)` on a `PaintedCursorState` whose override another writer set to a painted cursor P. The sink writes x, then `setOverride(null)` writes `null`, so P is gone and the base shows instead. On the element the same sequence puts back the cursor the override replaced, as the doc promises ("an override is written and later removed, putting back the cursor it replaced"). The two halves of one sink answer "what does clearing an override restore" two ways.
- evidence: read
- severity: low
- fix: packages/cursor/src/cursorSink.ts, packages/cursor/src/paintedCursorState.ts (needs a read of the current override)
- size: function
- cause: PaintedCursorState has no override read, so prior is not captured
- confidence: likely

## A finite but huge worldRadius reaches the painter as an infinite size
- where: packages/cursor/src/paint.ts:117-125 (worldCursorPx); packages/cursor/src/brushRing.ts:17 (world branch); packages/cursor/src/resolve.ts:75
- scenario: `resolveCursor({ glyph: 'brush', worldRadius: 1e308 })` passes (only `=== Infinity` is refused), and `worldCursorPx(glyph, 1e308, 2)` = `1e308*2*24/9.9` = Infinity; `cursorPaintMatrix` then yields Infinity/NaN entries and `chromeLineWidthScale` 0. `brushRing(1e308, 'world')` likewise does not refuse although its doc says it refuses a radius whose size overflows. The px path does check overflow (`size === Infinity`), the world path never does.
- evidence: read
- severity: low
- fix: packages/cursor/src/paint.ts, packages/cursor/src/brushRing.ts
- size: line
- cause: overflow checked on the px path only
- confidence: likely

## Fit guards misread zero-radius and negative-radius circular arcs
- where: packages/cursor/src/types.ts:119-124 (walk)
- scenario: SVG draws an arc with `rx = 0` as a straight line, but `walk` takes `r = max(0, half)` and visits a whole disc of half the chord, so `rotationFitsInBox` / `haloFitsInBox` report false for a glyph whose segment fits, and `rotationStep` then throws for any nonzero angle on it. An arc authored `A -3 3 …` (SVG uses |rx|, |ry|; it is a circle) throws "elliptical arc" because `rx !== ry` compares signed values.
- evidence: read
- severity: low
- size: line
- cause: SVG's zero-radius and absolute-radius rules not applied
- confidence: likely

## PaintedCursorState's change test ignores `fallback`
- where: packages/cursor/src/paintedCursorState.ts:58-68 (same)
- scenario: `setBase({ kind: 'painted', glyph: 'brush', angle: 0, size: 200, fallback: 'crosshair' })` then the same with `fallback: 'default'` → `same` returns true, the stored cursor keeps `fallback: 'crosshair'`, and `current().cursor.fallback` answers the stale value. Every other field of `PaintedCursor` is compared.
- evidence: read
- severity: low
- size: line
- cause: field omitted from structural compare
- confidence: likely

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

<!-- done: 5 findings, files read: 12 -->
