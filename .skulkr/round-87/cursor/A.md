# Audit round 87 — area `cursor`

## createCursorSink recognizes its own write by string equality with `style.cursor`, which the browser hands back serialized, so an override set and then cleared without a base can stay on the element
- where: packages/cursor/src/cursorSink.ts:59 (giveBack), :88 (write, `prior` choice)
- scenario: a sink with no `setBase` call (the case the docstring says "owns only what it wrote") gets `setOverride({ kind: 'css', css: 'Pointer' })`, or a bare-string spec with extra whitespace (`'grab '`), or a baked cursor whose fallback has padding (`bakeFallback(' pointer')` returns it untrimmed, `bake.ts:38`). CSSOM serializes the assigned value: keywords come back lowercased and whitespace collapsed, so `el.style.cursor` reads `'pointer'` / `'grab'`. On `setOverride(null)`, `giveBack` compares `el.style.cursor === css` (`'pointer' === 'Pointer'`), sees a mismatch, treats the sink's own write as some other code's, and does not put back `prior`. The override's cursor stays on the element for good. The same mismatch at :88 makes a later write pick the sink's own earlier value as `prior`. It should compare against the value read back after its own write, i.e. store `el.style.cursor` after the assignment rather than the string it assigned.
- evidence: read (code path); the serialization behavior is inference from CSSOM rules and was not run here
- severity: medium

## brushRing answers a 24 px default ring for a negative, NaN or infinite radius instead of rejecting it or drawing it at its minimum size
- where: packages/cursor/src/brushRing.ts:14-18 (brushRing)
- scenario: `brushRing(-5)` gives `size = Math.round(-5*24/9.9) = -12`. `brushRing(-5, 'world')` gives `worldRadius: -5`. `brushRing(Infinity)` gives `size: Infinity`. `resolveCursor`'s `positive()` (`resolve.ts:54`) drops each of these and bakes the default 24 px ring, which reads as a brush of about 9.9 px radius. For a non-negative radius the function goes out of its way to clamp to at least one pixel ("so a brush too small to round to one is not drawn at the default size"), so a radius that is below zero, NaN or infinite gets the very behavior that clamp exists to prevent. An infinite radius should go to the painted tier or be capped, and a negative one should clamp like 0 does.
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

<!-- done: 2 findings, files read: 12 -->
