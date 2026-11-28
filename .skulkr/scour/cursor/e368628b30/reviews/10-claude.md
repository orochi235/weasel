# cursor — blind review findings

## bakeFallback refuses valid `url(…)` fallbacks whose hotspot uses an exponent or a plus sign, or whose unquoted URL holds an escape
- where: packages/cursor/src/bake.ts:40 (IMAGE_ENTRY, used by bakeFallback)
- scenario: `bakeCursor(GLYPHS.pen, { fallback: 'url(pen.png) 1e1 4, auto' })`, or `'url(pen.png) +4 +4, auto'`, or `'url(a\\(b.png), auto'` → `RangeError: cursor fallback … is not a cursor value`. Each is a valid CSS `cursor` list (a hotspot is a CSS `<number>`, which allows a sign and an exponent; an unquoted `url()` allows backslash escapes), so the browser would accept it. The hotspot pattern `-?\d*\.?\d+` and the unquoted-url class `[^\s"'()\\]*` reject them, the regex fails to consume the entry, and the remainder is not a keyword. The same validation runs in `cursorFor` and `resolveCursor`, so every tier throws.
- evidence: read
- severity: low
- size: line
- cause: hand-rolled number/url grammar narrower than CSS
- confidence: sure

## A CSS override from a sink that never took the base clears another writer's painted override instead of putting it back
- where: packages/cursor/src/cursorSink.ts:69 (writePainted)
- scenario: other code sets `painted.setOverride(ringA)` (a painted affordance cursor). A sink with no `setBase` yet calls `setOverride({ kind: 'css', css: 'grab' })` → it writes `'none'` to the painted override, replacing `ringA`. Then `setOverride(null)` → `ownsPaintedOverride` is true, so it writes `painted.setOverride(null)`, and `ringA` is gone. The element's style, by contrast, is restored to what it showed before ("putting back the cursor it replaced unless other code has written one since", per `createCursorSink`'s doc). The two halves of one override answer "what happens to what I replaced" differently: the painted half should remember the prior override and put it back unless it has changed since, as `written.prior` does for the element.
- evidence: read
- severity: low
- size: function
- cause: no prior kept for the painted override slot
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
