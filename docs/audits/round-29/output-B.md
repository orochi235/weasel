# Audit 29 — reviewer B (drawing and output)

## `registerFont(..., { replace: true })` on a variant already drawn keeps drawing the old atlas texture with the new metrics
- where: packages/font/src/registerFont.ts:409 (ensureFontTexture), packages/renderer/src/cache/GLTextureCache.ts:50 (upload → ensure); new path at registerFont.ts:206 (replaceVariant) and :268
- scenario: a variant is registered and drawn once (its atlas uploaded under `textureCacheKey(family, weight, style)`), then re-registered with other URLs and `{ replace: true }`. The new fetch lands and `registry.set` swaps in the new `{ font, bitmap }`, but `ensureFontTexture` calls `textureCache.upload(key, entry.bitmap)`, which "uploads the pixels once per id" and returns the cached texture for an id it already holds. Layout now reads glyph rects from the new BmFont while sampling the old bitmap: wrong or garbled glyphs until the GL context is rebuilt. Should send the new bitmap (as `uploadRegistered` does when the source changes) or key the texture by something that changes with the atlas.
- evidence: read
- severity: medium

## Disposing an overriding paint draw kind uncovers the old kind but leaves the override's shader programs in place
- where: packages/renderer/src/paintKinds.ts:164-169 (registerPaintDrawKind)
- scenario: kind `k` declares `programs: { p: srcA }`; a second `registerPaintDrawKind({ id: 'k', programs: { p: srcB } })` overrides it, and `registerProgram('p', srcB, { replace: true })` replaces the program. Disposing the override pops `KINDS` back to the first entry, but nothing restores `p`: the uncovered kind's `bind` names `p` and draws with srcB. The disposer also never releases the programs of a kind removed outright, so they stay registered after the kind is gone. The disposer should release (or restore) the programs it registered, as the kind registry restores the entry.
- evidence: read
- severity: medium

## A paint kind's failed (or finished) load is cached by id, so a replacement loader for that id is never called
- where: packages/renderer/src/paintKinds.ts:194, 213-230 (LOADS, startLoad)
- scenario: `registerPaintDrawKindLoader('x', a)`; a frame meets `x`, `a()` rejects (network error), `LOADS` keeps the rejected promise under `'x'`. The app then registers `registerPaintDrawKindLoader('x', b)` (the override the doc says stacks) — `startLoad('x')` returns the cached rejection, `b` is never called, and `warmPaintKinds(['x'])` rejects with `a`'s error forever. The cache should be keyed by the loader (or cleared when the live loader changes). Likewise disposing the loader that registered `x` leaves `x` registered, since the registration's disposer is dropped (`startLoad`'s `registerPaintDrawKind(entry)`, and paint-kinds' wrapper at packages/paint-kinds/src/paintKinds.ts:164).
- evidence: read
- severity: medium

## The built-in `mesh-gradient` loader is not pushed as a fallback, so a consumer's own loader for it draws the clash warning
- where: packages/paint-kinds/src/paintKinds.ts:118, 161-167 (seed, registerPaintKindLoader) → packages/renderer/src/paintKinds.ts:209-211 (registerPaintDrawKindLoader)
- scenario: `seed()` calls `registerPaintKindLoader('mesh-gradient', load, { fallback: true })`, but the options reach only the eventual `registerPaintKind`; `registerPaintDrawKindLoader` takes no options and calls `LOADERS.push(id, load)` with no `fallback`. A consumer calling `registerPaintKindLoader('mesh-gradient', mine)` in development gets "registered over an unnamed registrant, which is not an engine default", which is exactly what `fallback` exists to suppress (e0f4c91b27 marks every other built-in so).
- evidence: read
- severity: low

## SVG region export culls nodes by their unrotated, unstroked pose box, so it drops content PNG/PDF draw in the same region
- where: packages/svg/src/regionSvgNodes.ts:50-52, 134-139 (meets, include)
- scenario: `include` keeps a node only when `meets(pose(node), region)`, with `pose` the world `RectPose`'s `x/y/width/height` — rotation, `transform` (skew/scale) and stroke width are all ignored, and a group's own box decides for its whole subtree (fromKit's `include` "leaves a node out, with everything under it"). A rect rotated 45° whose corner crosses into the region, a shape whose thick stroke straddles the region edge, or a child lying outside its group's box is drawn by `exportRegionPng`/`exportRegionsPdf` (which clip to `sourceRect`) but missing from `exportRegionSvg` of the same region. `selectionRegion` already measures with `drawnAabbOf` (strokes included); the SVG cull should use the drawn world bounds too.
- evidence: read
- severity: medium

## `serializeSvg` hands `<defs>` warnings to the raw `onWarn`, so they repeat once per def despite the once-per-call contract
- where: packages/svg/src/serialize.ts:85 (serializeSvg → `registry.toDefsXml(opts.onWarn)`); packages/svg/src/gradients.ts:397-414 (toDefsXml)
- scenario: every body warning goes through the deduping `warn` built at the top of `serializeSvg`, but the defs pass is given `opts.onWarn` itself. A document with N texture-pattern fills (each its own def) calls `onWarn` N times with the identical "texture fill carries a TextureHandle…" message; N markers with `toSvg` and a `size` likewise. `SerializeOptions.onWarn` promises "Each message is said once per call". Pass `warn` instead.
- evidence: read
- severity: low

## pdf README still says `skipped` entries are `'glyph' | 'command'`; the writer now also emits `kind: 'font'`
- where: packages/pdf/README.md ("`skipped`" section) vs packages/pdf/src/writePdf.ts:55-58 (PdfSkip) and packages/pdf/src/fonts/embedFont.ts:207-211 (DocumentFonts.load)
- scenario: since 5db4fbd607 a face that fails to read or is not well-formed TrueType pushes `{ kind: 'font', detail }` into `skipped`. The README tells a `writePdf` caller each entry is `{ kind: 'glyph' | 'command', detail }` and its list of what is reported omits faces, so a caller switching on `kind` per the doc drops these.
- evidence: read
- severity: low
<!-- done: 7 findings, files read: 46 -->
