# cursor — blind review findings

## A cursor sink overwrites another writer's painted override and clears it to null instead of restoring it
- where: packages/cursor/src/cursorSink.ts:75 (createCursorSink → writePainted)
- scenario: two writers share one `PaintedCursorState` (another sink, or code calling `painted.setOverride` directly, as `createCursorSink`'s doc says it leaves alone). Writer A sets override painted `{glyph:'brush'}`. Sink B, which does not own the base, calls `setOverride('pointer')` → writePainted sets the state's override to `'none'` and marks `ownsPaintedOverride`. B then calls `setOverride(null)` → writePainted calls `painted.setOverride(null)`. A's brush override is gone while A still believes it is set; nothing paints until A writes again. The element's style is handled the other way: `write` records `prior` and `giveBack` restores it only if unchanged since. The painted slot gets no prior and no "unchanged since" check, so the two halves of one sink answer "put back what I replaced" differently. Likewise a sink that owns the base clears any override another writer set on the state on every write (`else if (ownsBase || ownsPaintedOverride) painted.setOverride(null)`).
- evidence: read
- severity: low
- fix: packages/cursor/src/cursorSink.ts
- size: function
- cause: painted override slot written without recording/restoring the prior value
- confidence: likely

## `bakeFallback` refuses valid `url(…)` fallback entries whose hotspot uses `+`, an exponent or a trailing dot, and any `image-set()` entry
- where: packages/cursor/src/bake.ts:40 (IMAGE_ENTRY, used by bakeFallback)
- scenario: `cursorFor('pencil', { fallback: 'url(pen.png) +4 1e1, crosshair' })` or `'url(pen.png) 4. 10, crosshair'` throws `RangeError: … is not a cursor value`, though CSS's `<number>` grammar admits `+4`, `1e1` and `4.` and the browser accepts the declaration. The hotspot pattern `-?\d*\.?\d+` only reads an optional minus, digits and a decimal part. Similarly, an `image-set(…)`/`-webkit-image-set(…)` image entry, which browsers accept in a `cursor` list, is refused because only `url(` is recognized. Also an unquoted `url()` with a CSS escape (`url(a\ b.png)`) is refused: the unquoted branch excludes `\`.
- evidence: read
- severity: low
- size: line
- cause: hotspot and image grammar narrower than CSS's
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

<!-- done: 2 findings, files read: 12 -->
