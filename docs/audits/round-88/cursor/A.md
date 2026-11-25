# Audit round 88 — area `cursor`

## A sub-step angle turns a glyph that cannot rotate on the painted tier but not on the baked one
- where: packages/cursor/src/resolve.ts:71 (resolveCursor), packages/cursor/src/bake.ts:62 (rotationStep)
- scenario: `resolveCursor({ glyph: 'pencil', size: 200, angle: 0.15 })`. `rotationStep` quantizes 0.15 rad to step 0, so the turnability guard passes, and the spec escalates to painted with `angle: 0.15`; `cursorPaintMatrix` applies the raw angle, so the pencil (which fails `rotationFitsInBox`) is drawn tilted 8.6°. The same spec at `size: 24` bakes upright, and at `angle: 0.3` throws. Whether a non-turnable glyph rotates is answered three ways by tier and by how close the angle is to 0. The painted spec should carry angle 0 (or the guard should throw) for a glyph that cannot turn.
- evidence: read
- severity: low

## cursorFor answers a cached cursor for an unknown glyph name instead of throwing
- where: packages/cursor/src/registry.ts:74 (cursorFor)
- scenario: the cache key is built and looked up before `cursorGlyph` validates the name. After `cursorFor('pen', { mark: 'add' })` has cached `pen+add|24|0|default`, untyped JS calling `cursorFor('pen+add')` builds the same key and gets the marked pen back; called before that entry exists, the same call throws `unknown cursor glyph`. The guard `cursorGlyph` documents for untyped JS is bypassed depending on cache state. Validate the name (and mark) before the lookup, or build the key from validated parts.
- evidence: read
- severity: low

## brushRing(-Infinity) does not throw, and draws at the default 24 px
- where: packages/cursor/src/brushRing.ts:15 (brushRing)
- scenario: the doc says it throws a `RangeError` for an infinite radius, but only `radius === Infinity` is checked. `brushRing(-Infinity)` gives `size: -Infinity` (or `worldRadius: -Infinity` in world units), which `resolveCursor`'s `positive` drops, so the ring is drawn at the 24 px default — the exact outcome the throw exists to prevent. Check `!Number.isFinite(radius)` (or `Math.abs`).
- evidence: read
- severity: low

## bakeFallback accepts fallbacks that make the browser drop the whole declaration
- where: packages/cursor/src/bake.ts:37 (bakeFallback)
- scenario: the stated purpose is to refuse a fallback that would make the browser drop the declaration and keep the previous cursor, but only `;`, `{`, `}` are refused. `fallback: 'url(hand.png)'` (a cursor list must end in a keyword), `'pointer !important'`, or `'"x'` all pass, produce `url("…") 3 4, url(hand.png)` etc., and the inline `style.cursor` write is silently ignored, leaving the prior cursor — the failure the guard claims to prevent. Same check is reused by `resolveCursor`, so it passes there too.
- evidence: read
- severity: low

## A CursorSink cannot give the element back once setBase has been called
- where: packages/cursor/src/cursorSink.ts:96 (createCursorSink setBase/write)
- scenario: the sink has no release. After `setBase(...)`, `ownsBase` is true forever: `setBase(null)` writes `rest` (default `''`) over the element's style, and the `prior` recorded in `written` (the element's own inline cursor before the sink wrote) is only restored if `element()` later answers a different element and another write happens. A surface that tears down its tool cursor (e.g. `useToolCursor`, whose layout effect has no cleanup) therefore leaves the sink's last cursor or `''` on an element that had an inline cursor of its own, and the painted state's base slot set. A `release()` that gives back `prior` and clears owned painted slots is missing.
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
