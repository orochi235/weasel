I couldn't write `.skulk/out/findings.md`: both the Write tool and shell redirection needed a permission that wasn't granted. The brief allows for that, so the whole document is below.

# Audit round 47, area `font`

## The within-family chain misses a family that has faces, unless one is a 400 or in the request's weight bucket
- where: packages/font/src/familyFace.ts:35-66 (familyFaceFor)
- scenario: Only `registerFont('Brand', { weight: 300 }, …)` is registered (a Light-only family), and text asks for `Brand` at 700. Step 2 searches only the bold bucket and finds nothing. Steps 3 and 5 accept only weight 400. Step 4/4b accept only 700, or a normal face in the bold bucket. The function returns `null`. `missResolveResult` then swaps in a different family and warns that `Brand` "has no variant … close enough", or under `'none'` draws nothing. Yet the family has a face the shader could fake bold on. The same happens for a family registered only at 700 and asked for 400, or only at 500 italic and asked for 800. CSS font matching always lands within a family that has any face. This chain should do the same: fall to the nearest registered face in any bucket, then either style, with synthetic flags.
- evidence: read
- severity: medium

## An outline-only default family is never substituted, and the warning says it is "not registered"
- where: packages/font/src/resolveFontVariant.ts:78-96 (missResolveResult)
- scenario: The app calls `registerFontOutlines('Brand', …)` and `setDefaultFontFamily('Brand')`, with no atlas. A run in an unregistered family reaches the substitute branch. The guard `fontRegistry.has(fallback) || isCanvasFont(fallback) || atlasPending(fallback)` is false, so the probe never runs. Even if it did, line 85 accepts only `entry` or `dynamicFace`, never `outlineFace`. The text draws nothing, and `warnUnusableDefaultOnce` says the fallback "is not registered either". Yet `resolveFontVariant('Brand', …)` itself resolves fine on the outline tier, which this file ranks above every fallback. A default served by the outline tier should be substituted like an atlas or canvas one.
- evidence: read
- severity: medium

## `cssFontFamily` returns an unquoted family name, which a name like `Font 3D` makes invalid CSS
- where: packages/font/src/domFace.ts:100-106 (cssFontFamily)
- scenario: Calling `registerCanvasFont('Font 3D')` and editing its text runs `privateFamily`, which returns null because the source is `'canvas'`. The same happens with an atlas-only family, or one with no outline file. `cssFontFamily` then returns `family` as it stands. text-dom assigns the result straight to `style.fontFamily` (`overlayStyle.ts:24`, `domRuns.ts:201`). `Font 3D` is not a valid unquoted family because `3D` is not an identifier, so the declaration is dropped. The overlay then shows the inherited font, not the face the canvas draws. The private-face path on the next line already uses `cssFamilyName(family)` for its fallback, and the canvas rasterizer quotes through `cssFamilyName` too. Only the early return bypasses it.
- evidence: read
- severity: medium

## With no canvas available, `resolveFontVariant` throws for a canvas font, but the per-code-point escalation catches the same error
- where: packages/font/src/resolveFontVariant.ts:30-38, 58-69 (missResolveResult) vs packages/font/src/canvasFallback.ts:25-37
- scenario: Under SSR, in a worker without `OffscreenCanvas`, or in jsdom without a canvas, run `setFontFallbackPolicy('canvas')` (or call `registerCanvasFont(f)`) and resolve a miss. `getDynamicFace` → `getRasterizer` → `createCanvasRasterizer` throws "no canvas available". The throw is not caught, so it escapes `resolveFontVariant`, `cssFontFamily` and layout. `autoEnrollCanvasFont` has already recorded the family by then. The rasterizer is not cached on failure, so every later resolve throws again. `resolveCanvasFallback` wraps the same call in try/catch and documents "no canvas to rasterize into (SSR, a jsdom test without one)" as a soft miss. One question gets two answers.
- evidence: read
- severity: medium

## Under `'none'`, a family explicitly registered with `registerCanvasFont` gets no per-code-point escalation, and the warning tells the user to call `registerCanvasFont`
- where: packages/font/src/canvasFallback.ts:24 (resolveCanvasFallback); packages/font/src/glyphWarnings.ts:11-20 (warnMissingGlyph)
- scenario: `Inter` has a baked atlas, the app calls `registerCanvasFont('Inter')` and `setFontFallbackPolicy('none')`, and the text holds an em dash the atlas never baked. The atlas wins the resolve. `resolveGlyph` then asks `resolveCanvasFallback`, which returns null under `'none'` without checking `isExplicitCanvasFont`. The glyph is skipped with a warning that says "call registerCanvasFont("Inter") to serve missing codepoints", which was already done. `isCanvasFont` documents an explicit enrollment as served "under every policy; a consumer naming a family outranks the policy". `resolveColorCluster` drops emoji the same way.
- evidence: read
- severity: low

## A request whose family has landed faces is laid out in a stand-in while the variant the chain would pick is still fetching
- where: packages/font/src/resolveFontVariant.ts:170-181 (resolveFontVariantInternal)
- scenario: `Brand` 400 has landed and an eager `registerFont('Brand', { weight: 700 }, …)` is still fetching. Text asks for 600. `variantLoad(family, '600|normal')` is undefined and the family map is not empty, so `familyFaceFor` returns 400 with synthetic bold. When 700 lands, the run reflows into it. The function's own comment says an atlas on its way outranks every stand-in, to avoid exactly this reflow. `isFontPending` answers the same request as pending ("the within-family chain may resolve to whichever variant it brings"). Only the exact key is checked here.
- evidence: read
- severity: low

## `warmFonts` with a family name resolves successfully when that family's loads have already failed
- where: packages/font/src/warmFonts.ts:46-50 (warmFonts)
- scenario: An eager `registerFont('Brand', …)` 404s, and its rejection goes to the caller who ignored it. Later, `await warmFonts(['Brand'])` before `renderSceneToPixels` resolves: `isRegisteredFamily` is true, `wakeFamily` has nothing left to start, and `familyLoads` is empty. The export then draws nothing, or a substitute. The docs say it "rejects when a load fails" and "resolves once they have all landed", but nothing has landed here.
- evidence: read
- severity: low

## `warmFonts` with a `FontRequest` doesn't load the substitute when the family is registered but its chain finds no face
- where: packages/font/src/warmFonts.ts:66 (variantLoads)
- scenario: `Brand` has only a 300 face (see the first finding) and the default family `Body` is declared `lazy`. `warmFonts([{ family: 'Brand', weight: 700 }])` hits line 66, because `fontRegistry.has('Brand')`, and returns only `Brand`'s loads, which are empty. Resolving `Brand` 700 then substitutes `Body`, which was never warmed. A synchronous render lays it out as pending and draws nothing. The function claims to mirror `resolveFontVariantInternal`, which falls through to the substitute in exactly this case.
- evidence: read
- severity: low

## The font picker lists a lazily declared variant immediately but an eagerly registered one only once it lands
- where: packages/font/src/registerFont.ts:246-248 (variantKeysOf), used by packages/font/src/fontCatalog.ts:18-47 (listAtlasFonts, listFontWeights)
- scenario: `registerFont('Brand', { weight: 700 }, m, a, { lazy: true })` puts 700 in `listAtlasFonts()` and `listFontWeights('Brand')` right away. The same call without `lazy` leaves 700 out of both until the fetch lands, because in-flight eager loads (`loads`) are not part of `variantKeysOf`. A picker built after an eager registration at startup is missing the variant. When the lazy fetch later fails, the variant disappears from the list. The same registration is reported two ways depending on a fetch-timing option.
- evidence: read
- severity: low

## A replaced or superseded atlas `ImageBitmap` is never closed
- where: packages/font/src/registerFont.ts:189-194 (fetchVariant)
- scenario: `registerFont(f, v, m2, a2, { replace: true })` puts a new face in the registry, but the old entry's `bitmap` is dropped without `close()`. A fetch overtaken by a replacement (`landFontUrls` false) also discards its freshly decoded bitmap unclosed. Each swap in a font-switching UI holds a full atlas of decoded image memory until GC gets to it. `ImageBitmap.close()` exists to release that memory deterministically.
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

<!-- done: 10 findings, files read: 42 -->