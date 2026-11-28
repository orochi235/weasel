# Findings: cursor

## `PaintedCursorState` treats two painted cursors differing only in `fallback` as the same, so it keeps the stale one
- where: packages/cursor/src/paintedCursorState.ts:60 (same)
- scenario: `setBase({ kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 4, fallback: 'crosshair' })`, then `setBase({ …same…, fallback: 'default' })` (useToolCursor re-calls `setBase` when only `tier.fallback` changes, since its key includes it). `same()` compares glyph, mark, angle, size and worldRadius but not `fallback`, so the second write returns early without storing the new object, and `current().cursor.fallback` still answers `'crosshair'`. It should store the new cursor; skipping the notify is fine because nothing drawn changed. No caller in the repo reads the state's `fallback` today (the sink keeps its own copy), so the stale value only shows through the public `current()`.
- evidence: read
- severity: low
- fix: packages/cursor/src/paintedCursorState.ts
- size: line
- cause: structural equality omits a field
- confidence: sure

## `bakeFallback` refuses cursor values Chrome accepts: `-webkit-` keyword aliases and `image-set()` entries
- where: packages/cursor/src/bake.ts:35 (CURSOR_KEYWORDS, IMAGE_ENTRY, bakeFallback)
- scenario: `cursorFor('pencil', { fallback: '-webkit-grab' })`, or `{ fallback: 'image-set("a.png" 1x, "a@2x.png" 2x) 4 4, default' }`, throws `RangeError: cursor fallback … is not a cursor value`. Chrome parses both: it keeps `-webkit-grab`/`-webkit-grabbing`/`-webkit-zoom-in`/`-webkit-zoom-out` as aliases, and `image-set()`/`-webkit-image-set()` are valid `<cursor-image>` entries. The rule (docs/unruled.md, cursor audit 88) is to refuse what is *not* a cursor value, so these should pass. The `image-set` case is the more realistic one, since it is the usual way to give a bitmap cursor a retina variant.
- evidence: read (the Chrome parsing behavior is from memory of Blink, not tested here)
- severity: low
- fix: packages/cursor/src/bake.ts
- size: function
- cause: keyword/entry grammar narrower than CSS
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
