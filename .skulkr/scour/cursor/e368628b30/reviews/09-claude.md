# cursor — blind review findings

## A sink that owns the base clears every other writer's painted override on each write
- where: packages/cursor/src/cursorSink.ts:84 (createCursorSink → writePainted)
- scenario: two sinks share one `PaintedCursorState` (routing's `hoverCursor` builds its own `ownSink` over the same
  canvas and painted state when no shared sink is handed to it). The hover sink sets a painted override (e.g. `rotate`
  at size 200). The base sink's next `setBase` (every `<Canvas>` render via `useToolCursor`) runs
  `else if (ownsBase || ownsPaintedOverride) painted.setOverride(null)` because its own override is null, wiping the
  hover sink's override, and writes the base css over the element too. The rotate cursor vanishes mid-hover until the
  next pointermove. Expected: a sink clears only an override it set (`ownsPaintedOverride`), not any override on the
  shared state; line 73 has the same `ownsBase ||` clause when the painted state changes.
- evidence: read (whether the two-sink case occurs depends on `cursorSink()` returning null beside `usePaintedCursor`'s sink, not traced)
- severity: low
- fix: packages/cursor/src/cursorSink.ts
- size: line
- cause: ownsBase treated as owning the override slot
- confidence: likely

## A finite world radius whose painted size overflows leaves the surface with no cursor at all
- where: packages/cursor/src/brushRing.ts:16 (brushRing), packages/cursor/src/paint.ts:117 (worldCursorPx)
- scenario: `brushRing(1e306, 'world')` (or a spec with `worldRadius: 1e306`) is accepted; `resolveCursor` returns a
  painted cursor, the sink writes `cursor: none`, and at any zoom `worldCursorPx` returns `Infinity`, which the painted
  layer (`paintedCursorLayer.ts:94`) skips. The user sees neither the ring nor the `crosshair` fallback. The px unit
  refuses the same overflow with a `RangeError` (ruled 2026-11-25), so the two units answer one input two ways.
- evidence: read
- severity: low
- fix: packages/cursor/src/brushRing.ts, packages/cursor/src/paint.ts
- size: function
- cause: overflow check only on the px path
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
