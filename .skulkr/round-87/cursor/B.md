# Audit round 87 — area `cursor`

## A sink's override is never taken off when the browser serializes the cursor it wrote differently
- where: packages/cursor/src/cursorSink.ts:59 (giveBack) and :88 (write, `prior`)
- scenario: `setOverride({ kind: 'css', css: 'Grab' })` (or `'grab '`, or a baked cursor whose fallback is `'Pointer'`). The CSSOM setter stores it and `el.style.cursor` reads back the serialized `'grab'`. `setOverride(null)` then calls `giveBack`, whose `el.style.cursor === css` test compares `'grab'` with `'Grab'`, fails, and leaves the override on the element for good. The same comparison in `write` reads the sink's own earlier cursor as "other code wrote over it" and records it as `prior`, so a later element switch puts the sink's own cursor back instead of the original. It should compare against what the element reads back after the write (record `el.style.cursor` after assigning), not the string passed in.
- evidence: read (inference about CSSOM serialization; not run)
- severity: medium

## The sink clears painted overrides it never set, unlike the element side
- where: packages/cursor/src/cursorSink.ts:66-75 (writePainted)
- scenario: the doc says the sink "owns only what it wrote" until `setBase`. On the element that holds, but every write calls `painted.setOverride(null)` when the sink has no override, and on a state switch it calls `paintedTo.setOverride(null)` on the old state unconditionally. Say a second writer, for example another sink or code calling `state.setOverride(ring)` directly, holds a painted override on a shared `PaintedCursorState`. Any `setBase` or `setOverride(null)` through this sink then wipes that override. It should write the painted override slot only when it set one, as it already does for the base slot with `ownsBase`.
- evidence: read
- severity: low

## `placeCursorPath` with a negative scale mirrors arc endpoints but not their sweep flag
- where: packages/cursor/src/mark.ts:31 (placeCursorPath, `A` branch)
- scenario: `placeCursorPath('M 12 2 A 10 10 0 0 1 22 12', -1, 24, 0)` mirrors both endpoints in x, but `sweep` is emitted unchanged (and the radii come out negative, which SVG takes as their absolute value). A mirror reverses the arc's direction, so it bulges to the wrong side of its chord and the shape is not the mirror of the input. The function is public and takes any `k`. For `k < 0` it should flip `sweep` (or refuse a non-positive `k`).
- evidence: read
- severity: low

## `brushRing(Infinity)` draws the default 24 px ring instead of refusing an infinite size
- where: packages/cursor/src/brushRing.ts:18 (brushRing)
- scenario: `brushRing(Infinity)` gives `size: Infinity`. `brushRing(Infinity, 'world')` gives `worldRadius: Infinity`. `resolveCursor`'s `positive()` drops both as non-finite, so an infinitely large brush shows as a 24 px CSS ring with no error. The ruling (unruled.md 2026-11-10) sends only negative and `NaN` radii to the default, and says an infinite size throws at bake. `brushRing` should throw or clamp for an infinite radius, not shrink it to the default.
- evidence: read
- severity: low

## `runs()` takes `WEASEL_PBT_RUNS=Infinity` as an infinite run count
- where: packages/cursor/src/pbt.fixture.ts:10 (runs)
- scenario: `Math.floor(Number('Infinity'))` is `Infinity`, which passes `deep >= 1`. So `numRuns` is `Infinity` and `timeoutFor` returns `Infinity`, and a property test given that env value never finishes and never times out. It should require `Number.isFinite(deep)`.
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
