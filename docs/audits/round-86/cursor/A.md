# Audit round 86, area `cursor`

## Changing an override puts back a stale cursor when other code wrote the element in between
- where: packages/cursor/src/cursorSink.ts:70 (createCursorSink, write)
- scenario: The sink has never had `setBase` called. `setOverride(A)` runs on an element showing `pointer`, so `written.prior = 'pointer'` and the element gets A's css. Other code then writes `grab` to the element. Next, `setOverride(B)` runs, with B a different cursor. `write` keeps `prior: written.prior`, which is still `'pointer'`, and overwrites `grab` with B's css. Then `setOverride(null)` finds B's css still on the element and restores `'pointer'`. So the sink first erases another writer's `grab` and then puts back a cursor that is out of date. The doc promises it "owns only what it wrote" and leaves alone a cursor other code has written since. When `el.style.cursor !== written.css` at re-write time, the current value should become the new `prior` (or the sink should leave the element alone).
- evidence: read
- severity: low

## Switching the target element or painted state leaves the old one with the base cursor, or with `none`, for good
- where: packages/cursor/src/cursorSink.ts:62 (createCursorSink, write)
- scenario: Once `setBase` has been called, take a painted base (the brush ring). The sink writes `cursor: none` to element A and `setBase(painted)` to state S1. Now `element()` starts answering B, or `painted()` starts answering S2, with no override set. `write` only cleans up the old element through `unwrite`, and `unwrite` only runs when an override was written. So A keeps `cursor: none`, which means no pointer at all over A from then on. S1 also keeps its base and override, so its layer keeps drawing a cursor. The sink has no dispose either, so teardown cannot clear them. The doc gives back only the element an override was written to. The element the base was written to, and the old painted state, get nothing back.
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
