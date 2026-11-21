# Audit round 63 — area `font` — findings

Note: the brief names commit 1b4edb3a93db1759496d564da57eb13020b3d7d2, which this checkout does not have
(`git cat-file` reports a bad object). Read against the checked-out HEAD, 6f634fabe1.

## A sharp color bake that finds no room while the sharp pages refill is never asked for again
- where: packages/font/src/dynamic/sharpColor.ts:68 (requestLevel), packages/font/src/dynamic/bakeQueue.ts:157 (noRoom)
- scenario: after an emptying (`reclaim`/`reclaimSharp` sets `sharpRoom.settled = false`), enough large emoji ask for
  sharper levels that the sharp pages fill before a quiet frame settles them. `noRoom` returns silently for the sharp
  room (no `starved` entry, no reclaim), and `requestLevel` has already stored the record in `levels[level]` with
  `page: -1`. Every later `sharperColorGlyph` call finds `known !== undefined` and returns without re-baking, and no
  `retryStarved` path exists for sharp records. Once the room settles, nothing re-requests the level, so the emoji
  stays on its blurry base bake until some *other* new sharp request happens to trigger `reclaimSharp` and bump
  `generation`. Static text with a few big emoji stays blurry forever. Should: re-bake (or drop the cached
  unbaked level) once the sharp room settles, as field/color glyphs do through `starved`/`retryStarved`.
- evidence: read
- severity: low

## A canvas face whose CSS `font` string is invalid is measured and rasterized in the previous face's font and size
- where: packages/font/src/dynamic/glyphRasterizer.ts:138 (setFont), :120 (cssFontString); reached from
  packages/font/src/dynamic/dynamicAtlas.ts:333 (measureFace) and :278 (requestGlyph)
- scenario: `ctx.font = …` silently ignores a value that does not parse as the `font` shorthand and keeps the
  last one. `cssFontString` writes the weight through unchecked, and nothing on the way (`normalizeVariant`,
  `resolveCanvasFallback`, `getDynamicFace`) clamps or rejects it, so a weight outside CSS's [1, 1000] (0, 1100, a
  tween overshooting under an elastic ease) or NaN makes the string invalid. Sequence: a valid face is created
  (`faceMetrics` leaves `ctx.font` at `400 1000px "Valid"`), then text asks for `("X", 1100, 'normal')`:
  `faceMetrics` measures "Valid" at 1000px and `requestGlyph` → `draw` measures and fills "Valid" at **1000px**
  instead of 48px, so advances come out ~20× too wide and each bitmap is ~1000px (or "larger than a page"). The
  wrong glyphs are cached under X's face key. Should: clamp/validate the weight (or check that `ctx.font` took the
  value) before measuring, rather than inheriting whatever font was set last.
- evidence: read
- severity: medium

## The canvas tier's face cap evicts by creation order, so the face in use longest is the first dropped
- where: packages/font/src/dynamic/dynamicAtlas.ts:246 (getDynamicFace) and :320 (dropOldestFace)
- scenario: `getDynamicFace` returns a cached face without moving it in `faces`, so `faces.entries().next()` is
  the face created first, which is usually the app's main UI face, drawn every frame. When the 257th face is
  created (a weight tween, a font field being typed into, or a page showing many weights), that face is dropped,
  its pending bakes abandoned and `notifyGlyphReady` fired. The next layout recreates it, which evicts the next
  oldest face, and so on. Every glyph of every recreated face is measured and baked again into new rects (the old
  rects are not freed), so a scene with more than 256 faces in use thrashes every frame and fills the pages until
  they are emptied. Should: evict least-recently-used, e.g. re-insert on a cache hit.
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

<!-- done: 3 findings, files read: 42 -->
