I couldn't write `.skulk/out/findings.md` because permission to write it was denied, so the whole findings document is below.

# Audit round 47, area `font`: reviewer findings

Note: the checkout's HEAD is 782733b19c, not the 44e73a944b the brief names. Line numbers are from the tree as checked out.

## Resolving a landed face wakes every other lazily declared variant of its family
- where: packages/font/src/registerFont.ts:216-226 (wakeDeclared), which packages/font/src/resolveFontVariant.ts:165 (resolveFontVariantInternal) calls before anything else
- scenario: `registerFont('Inter', {weight: 400}, …)` is registered eagerly, then `registerFont('Inter', {weight: 700}, …, {lazy: true})`. Text set only in Inter 400 goes through `wakeDeclared('Inter', 400, 'normal')`. `400|normal` is not in `declared` because it already landed, so `keys` becomes every declared variant and the 700 atlas is fetched although no text asks for it. That breaks the `lazy` promise to "fetch nothing until text first resolves this face". `warmFonts`' `variantLoads` checks the registry before waking anything, so the two paths answer the same request differently.
- evidence: read
- severity: medium

## A multi-page BmFont atlas draws its page-1+ glyphs from page 0's image
- where: packages/font/src/FontAtlas.ts:83-131 (parseBmFont); packages/font/src/registerFont.ts:289-299 (ensureFontTexture)
- scenario: msdf-bmfont-xml writes `page: 1` for glyphs once the character set overflows one texture.
  - `parseBmFont` accepts any finite `page`.
  - `registerFont` takes a single `atlasUrl`.
  - `ensureFontTexture` and `textureCacheKey` key the texture on (family, weight, style) alone, and the renderer's `draw/text.ts:188-194` ignores `group.page` on the atlas tier.

  So every page-1 glyph samples page 0's texels at its own rect and draws pieces of another glyph. Instead, `parseBmFont` should refuse it and name the field, as it does for other malformed fields.
- evidence: read
- severity: medium

## The within-family chain serves nothing for a family whose only faces are italic, or only in the other weight bucket
- where: packages/font/src/familyFace.ts:35-66 (familyFaceFor)
- scenario: take a family registered only as `{ weight: 400, style: 'italic' }` and ask for 400 normal. Steps 2–5 look only at `normal` faces and find none, so the function returns null and the request misses: substitute warns, and `'none'` draws nothing, although the family holds a face. The same happens for a family registered only at 700 and asked for 400: both `nearestInBucket` calls reject the bold bucket and `(400, normal)` is absent. The chain never falls back to an italic face for upright text, or across the 600 weight line. `unruled.md` covers only the outline tier's version of this (2026-11-10, still open).
- evidence: read
- severity: medium

## warmFonts does not warm the substitute a registered family falls back to
- where: packages/font/src/warmFonts.ts:66 (variantLoads)
- scenario: 'Display' is registered eagerly, only at 400 italic. `setDefaultFontFamily('Inter')` is set, with Inter registered lazily.
  - `warmFonts([{ family: 'Display' }])` takes the `fontRegistry.has(family)` branch and returns only Display's loads.
  - `renderSceneToPixels` then resolves Display 400 normal. `familyFaceFor` returns null, and `missResolveResult` substitutes Inter, which only wakes now.
  - The synchronous render draws nothing.

  The resolver substitutes for a registered family whose chain finds no face, but `variantLoads` assumes a registered family never substitutes.
- evidence: read
- severity: low

## A canvas glyph that found no room right after an emptying stays invisible until some new glyph is asked for
- where: packages/font/src/dynamic/bakeQueue.ts:85-123 (bake, noRoom)
- scenario: the pages fill and `reclaim` empties them (`settled = false`), but the text on screen needs more glyphs than the pages hold.
  - The overflow glyphs keep `page: -1` and are not queued again. They stay in `charMap`, so `requestGlyph` keeps returning the same unbaked record.
  - The user scrolls so only part of the text, including some of those glyphs, is on screen. Nothing new is requested, so `noRoom` never fires with `settled` true and no reclaim is scheduled.
  - Those glyphs never draw (paintRuns skips `page < 0`), although there is now room for them.
- evidence: read
- severity: low

## The dynamic tier keeps one face per distinct (family, weight, style) forever
- where: packages/font/src/dynamic/dynamicAtlas.ts:220-286 (getDynamicFace); packages/font/src/dynamic/dynamicAtlas.ts:311-325 (refreshFamilies)
- scenario: `faces` loses entries only through `unregisterCanvasFont`. Each of these adds a face with its own measured metrics and glyph records:
  - a weight animated through fractional values, such as a `fontWeight` tween from 400 to 700;
  - families typed into a font field under the `'canvas'` policy, each of which is auto-enrolled and never dropped;
  - atlas families escalating code points through `resolveCanvasFallback`.

  Every `document.fonts` `loadingdone` event then measures all of them again. `variantKey` caps its own cache at 1024 weights for this reason, but this map has no cap.
- evidence: read
- severity: low

## A family name with an apostrophe is written raw into the canvas `font` and DOM `font-family`
- where: packages/font/src/cssFamily.ts:10-13 (cssFamilyName)
- scenario: call `registerCanvasFont("Hoefler's Text")`, or use any registry family with a `'`. The `/[,"']/` test treats the name as a CSS list the caller wrote and returns it unchanged.
  - The rasterizer sets `ctx.font = 400 48px Hoefler's Text`. That is an identifier followed by an unterminated string, not a valid family, so the browser ignores the assignment and glyphs bake in whatever font the context had last.
  - `cssFontFamily` returns `"weasel-face-0", Hoefler's Text`, an invalid declaration the edit overlay drops entirely.

  Only a comma, or a quote that opens a quoted name, should mark a list.
- evidence: read
- severity: low

## The dynamic tier's test resets leave timers and per-cache upload state that act on the next test's atlas
- where: packages/font/src/dynamic/bakeQueue.ts:190-199 (_resetBakeQueueForTests); packages/font/src/dynamic/dynamicPages.ts:201-205 (_resetPagesForTests)
- scenario: two problems.
  - A test that fills the pages schedules `reclaim` with `setTimeout(empty, 0)`. `_resetDynamicFontsForTests` clears the flag but not the timer, so the reclaim fires during the next test, empties its pages and forgets its glyphs.
  - `_resetPagesForTests` replaces `pages` but keeps `PageSet.uploaded`. A texture cache reused across the reset has `seen` versions above the new pages' versions, so `sync` never uploads their texels.
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

<!-- done: 8 findings, files read: 42 -->