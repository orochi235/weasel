## brushRing's Infinity guard misses a finite radius whose size overflows, which then draws at the default 24 px
- where: packages/cursor/src/brushRing.ts:15-20 (brushRing)
- scenario: `brushRing(1e307)` (unit 'px') passes the `radius === Infinity` guard, but `radius * glyph.box / ring` overflows to `Infinity`, so `size` is `Infinity`. `resolveCursor`'s `positive()` drops a non-finite size, so the ring bakes at the default 24 px. The guard exists to stop exactly that ("rather than draw it at the default"). It should throw, or the guard should test the computed size with `Number.isFinite`. `brushRing(-Infinity)` likewise draws a 24 px ring rather than throwing.
- evidence: read
- severity: low

## An infinite `size` throws in bakeCursor/cursorFor but draws at 24 px through resolveCursor
- where: packages/cursor/src/resolve.ts:56-57,66 (positive / resolveCursor) vs packages/cursor/src/bake.ts:24-32 (bakeSize)
- scenario: `cursorFor('pencil', { size: Infinity })` throws a RangeError (bakeSize: "past the cap, Infinity included"). `resolveCursor({ glyph: 'pencil', size: Infinity })` filters the size through `positive()` first, so it bakes a 24 px pencil. The same input gets two answers depending on the entry point. `brushRing`'s doc also leans on the bake behavior ("as bakeCursor refuses an infinite size"), which the spec path never reaches.
- evidence: read
- severity: low

## A painted cursor's `fallback` is validated and then dropped, so with no painted layer the sink shows no cursor at all
- where: packages/cursor/src/resolve.ts:72-78 (resolveCursor, painted arms) and packages/cursor/src/cursorSink.ts:34,93 (cssOf / write)
- scenario: `{ glyph: 'brush', worldRadius: 5, fallback: 'crosshair' }` (what `brushRing(5, 'world')` returns) resolves to a painted cursor that carries no fallback. A `createCursorSink` whose `painted()` answers `undefined` (no layer installed) still writes `cursor: none` to the element through `cssOf`, so the user sees no cursor. The spec's declared fallback (`'crosshair'`) is never used on any path, although `bakeFallback(fallback)` validates it. It should either reach the element when no painted state exists, or be carried in `ResolvedCursor`.
- evidence: read
- severity: medium

## On the painted tier, a glyph that cannot rotate is still turned by a small angle that the baked tier ignores
- where: packages/cursor/src/resolve.ts:67-77 (resolveCursor) with packages/cursor/src/paint.ts:96-104 (cursorPaintMatrix)
- scenario: `{ glyph: 'pencil', size: 200, angle: 0.15 }`. `rotationStep` quantizes 0.15 rad to step 0, so the "only a rotation-fitting glyph takes an angle" check passes. The painted arm keeps `angle: 0.15`, and `cursorPaintMatrix` turns the pencil by 0.15 rad. At `size: 24`, the same spec bakes unrotated. A glyph the docs say cannot take an angle gets one on one tier only. Angles up to about ±0.196 rad slip through.
- evidence: read
- severity: low

## bakeFallback rejects only `;{}`, so any other value that is not a keyword still makes the browser drop the whole cursor silently
- where: packages/cursor/src/bake.ts:37-41 (bakeFallback)
- scenario: `fallback: 'hand'` (a typo), `'url(a.png)'` (no trailing keyword) or `'pointer, grab'` passes. `bakeCursor` emits `url("…") 5 19, hand`. That is an invalid `cursor` value, so the browser drops the declaration and keeps the previous cursor. This is the very failure the RangeError says it guards against ("the browser would drop the whole declaration and keep the cursor before it"). Every resolved spec carrying such a fallback is a silent no-op.
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

<!-- done: 5 findings, files read: 12 -->
