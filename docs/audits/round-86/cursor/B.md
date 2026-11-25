## Sink leaves its base cursor on the old element when `element()` starts answering another
- where: packages/cursor/src/cursorSink.ts:66 (createCursorSink → write)
- scenario: `setBase(crosshair)` on el1 with no override set, so `written` is null; `element()` now answers el2 (the surface remounted its canvas, el1 survives); the next write only puts the base on el2. el1 keeps `crosshair` forever, because only an override's element is tracked and given back. When an override was on el1, `unwrite` even writes the base onto el1 again (line 59) instead of what el1 showed before the sink owned it. The doc says an element the sink stops answering is given back what it showed; that holds only for the override slot.
- evidence: read
- severity: low

## Painted-state swap is not cleaned up the way an element swap is
- where: packages/cursor/src/cursorSink.ts:63 (createCursorSink → write)
- scenario: `painted()` answers state A, and the sink writes a painted base or override to it; later `painted()` answers state B (the layer remounted). The sink writes to B, but A keeps its base and override, so a layer still subscribed to A keeps drawing a cursor nobody sets. The element target in the same sink is handed back on a swap (`written.el !== el` → `unwrite`), but the painted target is not, so one sink answers the same question two ways.
- evidence: read
- severity: low

## An invalid `fallback` throws on the CSS tier but is accepted when the same spec resolves painted
- where: packages/cursor/src/resolve.ts:69 (resolveCursor)
- scenario: `resolveCursor({ glyph: 'brush', size: 100, fallback: 'a;b' })` throws a RangeError from `bakeFallback`. `{ glyph: 'brush', size: 200, fallback: 'a;b' }` and `{ …, worldRadius: 5 }` return a painted cursor with no error. It should either throw on every tier, as glyph and mark validation does (line 70, "Thrown here on every tier"), or never throw. As it stands, a spec whose size crosses 128 changes whether it is valid.
- evidence: read
- severity: low

## A world-unit brush ring has no one-pixel floor, though the px unit does
- where: packages/cursor/src/brushRing.ts:14 (brushRing); packages/cursor/src/paint.ts:115 (worldCursorPx)
- scenario: `brushRing(0.01, 'world')` at zoom 1 → `worldCursorPx` gives about 0.024 CSS px, so the painted ring is invisible. `brushRing(0.01, 'px')` is clamped to at least one pixel by `Math.max(1, …)`, and radius 0 in world units is also sent to the one-pixel path. Only a small positive world radius gets no floor.
- evidence: read
- severity: low

## `runs()` passes a fractional `WEASEL_PBT_RUNS` straight to fast-check
- where: packages/cursor/src/pbt.fixture.ts:10 (runs)
- scenario: `WEASEL_PBT_RUNS=2.5` → `numRuns: 2.5`, which is not an integer run count (fast-check expects one). `timeoutFor` scales from the same value. It should be floored or rejected.
- evidence: read (inference about fast-check's handling)
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
