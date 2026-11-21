# Audit round 63 — area `font` (blind reviewer)

## The rooms settle at the first frame after a timer-run reclaim, before anything has baked again, so text needing more than the pages hold empties them on every refill
- where: packages/font/src/dynamic/bakeQueue.ts:225 (resetBakeBudget), with :181 (reclaim) and :150 (noRoom)
- scenario: Text whose distinct canvas glyphs outnumber the 4 field pages (for example ~1500 distinct CJK characters at 48 px plus padding, against roughly 1300 that fit) is baked in batches over several frames: 16 at a time in the frame, the rest through `flushPending` ticks. A frame that only draws asks for nothing (`asked === 0`) while `pending` drains. Then a flush bake misses, and `reclaim` runs on its timer: it sets every room to `settled: false` and clears `pending`. At the next frame's `resetBakeBudget`, `asked` still counts the frame before the reclaim (0), and `pending` is empty, so all three rooms are marked `settled = true` before one glyph has baked again. The refill then misses with `room.settled === true`, so `noRoom` schedules another `reclaim` instead of parking the glyph in `starved`. That reclaim again follows a frame that asked nothing, so the cycle repeats: the pages are emptied every refill and the last glyphs never stay drawn. What should happen: after an emptying, the rooms stay unsettled until what is on screen has baked again. The refill's misses should starve with the one "more glyphs are in use at once than its pages hold" warning, and the pages should then hold steady. The settle test needs to ignore frames from before the last reclaim, for example by having `reclaim` mark that no frame has asked since the emptying.
- evidence: read (traced the state transitions; not run)
- severity: medium

## The 256-face cap drops the face made first, not the face used longest ago, so a font in steady use is evicted and re-baked
- where: packages/font/src/dynamic/dynamicAtlas.ts:314 (getDynamicFace), :320 (dropOldestFace)
- scenario: An app draws its UI in a canvas-tier family from startup, and a weight tween or a typed font field creates canvas faces with new `(family, weight, style)` keys. `faces.get(key)` on a hit does not refresh the face's place in the Map, so the UI face stays first in insertion order. The 256th new face evicts it even though it is drawn every frame. `notifyGlyphReady` then relays out all text, the UI face is measured again from scratch, and every one of its glyphs bakes into new rects (the old rects are not freed until the pages fill and empty). The tween keeps doing this every 256 faces. What should happen: the face used longest ago goes first, for example by deleting and re-setting the key on a hit.
- evidence: read
- severity: low

## A sharp color bake that misses while the sharp pages refill is never asked for again, so that emoji stays on a softer bake until some other sharp bake empties the pages
- where: packages/font/src/dynamic/bakeQueue.ts:157 (noRoom), packages/font/src/dynamic/sharpColor.ts:68 (requestLevel)
- scenario: After the sharp pages are emptied (`settled: false`), large emoji ask for their sharper levels again. One that finds no room hits `if (room === sharpRoom) return;`: it is neither queued nor put in `starved`. Its `SharperColorGlyph` stays in `source.levels[level]` with `page: -1`, and `requestLevel` returns that known entry on every later call without calling `requestBake`. `sharperColorGlyph` keeps serving a lower level (or null) for as long as the sharp generation stands. With a stable set of emoji on screen, nothing triggers another `reclaimSharp`, so the emoji stays blurry at large zoom for good. What should happen: a missed sharp level should be forgotten (`levels[level] = undefined`) or retried once the room settles, as field glyphs are through `retryStarved`.
- evidence: read
- severity: low

## A `reclaimSharp` timer scheduled before a full `reclaim` still fires afterward and empties the freshly refilled sharp pages
- where: packages/font/src/dynamic/bakeQueue.ts:163-166 (noRoom), :181 (reclaim), :195 (reclaimSharp)
- scenario: In one frame a sharp bake misses (it schedules `reclaimSharp` and sets `reclaimScheduled` on the current `sharpRoom`), and a field or color bake also misses (it schedules `reclaim`). `reclaim` runs first and replaces `sharpRoom` with a new room, but `timers` still holds the queued `reclaimSharp`. That timer then clears the sharp pages again, bumps the sharp generation (every level is forgotten), and calls `notifyGlyphReady`, which relays out all text a second time. Any sharp bakes landed in between are thrown away. What should happen: a full reclaim cancels a pending `reclaimSharp`, or `reclaimSharp` checks that the room it was scheduled for is still current.
- evidence: read
- severity: low

## `parseBmFont` accepts `distanceField.distanceRange: Infinity`, which zeroes the field scale and makes synthetic bold Infinity
- where: packages/font/src/FontAtlas.ts:146-150 (parseBmFont), consumed at packages/font/src/textSdf.ts:193 (glyphFieldScale), :222 (syntheticBoldGrowth)
- scenario: An atlas JSON whose `distanceField.distanceRange` is `1e999` (Infinity once parsed) passes `typeof range === 'number' && range > 0`. Every other numeric field is checked with `isFiniteNumber`. `glyphFieldScale` then returns `[0, 0]`, so the shader's `fieldPerPx` is 0 and the antialiasing band falls to its 0.0005 floor: glyphs draw hard-aliased. `syntheticBoldGrowth` returns `Infinity`. What should happen: reject a non-finite range, or ignore it as absent, the way the rest of the parser does.
- evidence: read
- severity: low

## Files read
packages/font/src/FontAtlas.ts
packages/font/src/atlasResult.ts
packages/font/src/canvasFallback.ts
packages/font/src/cssFamily.ts
packages/font/src/defaultIgnorable.ts
packages/font/src/domFace.ts
packages/font/src/dynamic/bakeQueue.ts
packages/font/src/dynamic/distanceTransform.ts
packages/font/src/dynamic/dynamicAtlas.ts
packages/font/src/dynamic/dynamicPages.ts
packages/font/src/dynamic/fontLoads.ts
packages/font/src/dynamic/glyphRasterizer.ts
packages/font/src/dynamic/sharpColor.ts
packages/font/src/dynamic/shelfPack.ts
packages/font/src/emojiCluster.ts
packages/font/src/faceMetrics.ts
packages/font/src/fallback.ts
packages/font/src/familyFace.ts
packages/font/src/fetchAtlasFace.ts
packages/font/src/fontCatalog.ts
packages/font/src/fontStyle.ts
packages/font/src/glyphMetrics.ts
packages/font/src/glyphReady.ts
packages/font/src/glyphWarnings.ts
packages/font/src/heldFontUrls.ts
packages/font/src/index.ts
packages/font/src/metrics.entry.ts
packages/font/src/pbt.fixture.ts
packages/font/src/registerFont.ts
packages/font/src/registerFontWarnings.ts
packages/font/src/resolveFontVariant.ts
packages/font/src/resolveGlyph.ts
packages/font/src/resolveResult.ts
packages/font/src/test-seams.ts
packages/font/src/testing/dynamic.ts
packages/font/src/testing/registerTestFont.ts
packages/font/src/textSdf.ts
packages/font/src/textSdfWgsl.ts
packages/font/src/textureCacheKey.ts
packages/font/src/textureSink.ts
packages/font/src/variantKey.ts
packages/font/src/warmFonts.ts

<!-- done: 5 findings, files read: 42 -->
