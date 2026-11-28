# Audit round saturation, area `cursor`

## A px brush ring's line weight grows with its radius, while a world ring of the same screen size keeps chrome weight
- where: packages/cursor/src/brushRing.ts:21 (brushRing)
- scenario: `brushRing(100)` (unit `'px'`) returns `{ glyph: 'brush', size: 242 }`. Past 128 it resolves to the painted tier with a fixed `size`, which the layer draws with no `lineWidthScale`, so the ring's 1.6-unit stroke lands at 1.6 × 242 / 24 ≈ 16 CSS px, inside a halo ≈ 42 px wide: the "filled blob" `paintedCursorLayer` avoids for world rings. Below the cap the same happens on the baked tier (`brushRing(50)` → size 121, a ≈ 8 px ring). `brushRing(100, 'world')` at zoom 1 draws the same 100 px ring at 1.6 px. One question, how heavy a brush ring's line is, is answered two ways by unit, and the px unit makes a large brush unreadable as a ring.
- evidence: read (traced `brushRing` → `resolveCursor` → `paintedCursorLayer` / `bakeCursor`; `chromeLineWidthScale` applied only when `worldRadius` is set)
- severity: medium
- fix: packages/cursor/src/brushRing.ts, packages/cursor/src/resolve.ts, packages/cursor/src/bake.ts, packages/core/src/canvas/paintedCursorLayer.ts
- size: design
- cause: line-weight scaling tied to spec form, not to the glyph's purpose
- confidence: likely

## The painted cursor state keeps a stale pointer position across an inactive spell, so a reactivated painted cursor draws where the pointer used to be
- where: packages/cursor/src/paintedCursorState.ts:86 (setPointer), packages/cursor/src/paintedCursorState.ts:101 (current)
- scenario: the hover pump writes `setPointer` only while `active()` (`hoverCursor.ts:137`), as this module's `active()` doc invites. A brush tool is active with the pointer at A; something sets a CSS override (`setOverride('none')`, e.g. hovering a handle) or the base clears, and the pointer moves to B with no `setPointer`, since nothing is painted. When the painted cursor comes back without a pointer move (the override clears on a timer or a non-key state change; `setBase` from a `<Canvas>` render after a tool change from code), `current()` returns `{ cursor, at: A }` and the ring draws at A, far from the real pointer, until the next move. `at` should be dropped when nothing is shown (so nothing draws until a fresh position), or the state should say a position is stale.
- evidence: read (contract between `active()` / `setPointer` here and the guarded caller in `packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:136`)
- severity: low
- fix: packages/cursor/src/paintedCursorState.ts
- size: function
- cause: position kept past the period it stops being written
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
