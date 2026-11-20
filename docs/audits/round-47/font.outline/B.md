I couldn't save the findings file: the first write to `.skulk/out/findings.md` went through, but every later write was refused for permission. The file on disk holds only the first finding. Here is the complete document:

# Audit round 47: area `font.outline`

The brief names frozen commit 44e73a944bea29d4d56fc7883fa302daec48ecf1, but that object isn't in this repo. I read the checked-out tree instead (HEAD 782733b19c, with `packages/font` unmodified).

## cffCheck never checks the FDArray font DICTs' Private DICTs, which opentype.js follows the same way
- where: packages/font/src/outline/cffCheck.ts:44 (checkCff)
- scenario: a CID-keyed CFF face (its Top DICT has `FDArray`, 12 36) has an FDArray font DICT holding `Private`, and that Private DICT holds a `Subrs` with two operands (or the `Private` has the wrong count).
  - `checkCff` reads the FDArray INDEX only for bounds (`readIndex`) and never parses its items as DICTs, so the face passes.
  - opentype.js 2's `gatherCFFTopDicts` (dist/opentype.mjs:6548–6570) treats every FDArray item exactly as it treats the Top DICT. `privateOffset + privateDict.subrs` adds an array, which yields a string offset, and `parseCFFIndex` reads at it. That is the minute-long parse the module header says this check exists to prevent.
  - Should: run the Top DICT's `Private`/`Subrs` checks (`readDict` + `checkPrivate`) on each FDArray item too.
- evidence: read (cffCheck.ts; opentype.js 2 dist `gatherCFFTopDicts`)
- severity: medium

## A local variable font registers its default instance's outlines under every named instance's weight
- where: packages/font/src/outline/localFonts.ts:162 (enableLocalFontOutlines); packages/font/src/outline/sfnt.ts:163 (sfntFromCollection)
- scenario: an installed variable font (one file with `fvar`) appears as one `FontData` per named instance. Each has its own `postscriptName`, and `blob()` returns the same file for all of them.
  - Each one is registered at its parsed weight with `createOpenTypeParser(postscriptName)`. For a file that isn't a collection, `sfntFromCollection` ignores the name and returns `matched: true`.
  - Nothing in `packages/font/src` applies `fvar` coordinates, so the 700 slot serves the default (usually Regular) outlines. Above the outline threshold, bold text turns light. This is the failure the collection path refuses a mismatched member to avoid (opentypeParser.ts:186–191).
  - Should: apply the named instance, or refuse a non-default instance so the SDF tier keeps that text.
- evidence: read; that Chromium lists each named instance as a separate `FontData` is inferred
- severity: medium

## A thunk or Blob source is read twice when DOM text asks for the face before the canvas does
- where: packages/font/src/outline/outlineRegistry.ts:343 (outlineCssSource)
- scenario: a face registered with a thunk source.
  - The edit overlay opens first: domFace `ensureFace` → `css.bytes()` → `readSource(source)` calls the thunk.
  - Then the canvas loads the face: `runLoad` → `readSource` calls the thunk again.
  - The font is downloaded twice, and a thunk that only works once fails on the second call. The registry's own doc says a thunk "is called at first use".
  - Should: share one read between the two paths, for example by memoizing it on the slot.
- evidence: read (outlineRegistry.ts; domFace.ts:182)
- severity: low

## gposPairKerning's pair memo has no bound
- where: packages/font/src/outline/gposKerning.ts:73
- scenario: every distinct glyph pair that any layout asks `kernOf` about adds a `Map` entry. Nothing ever evicts one, and the key space is 65536².
  - A long session in a face with a large glyph set (CJK, a long multilingual document) grows the map with no limit for as long as the face is registered.
  - Should: cap it, for example with an LRU.
- evidence: read
- severity: low

## Kerning adds up every `kern` lookup across all scripts, so a pair kerned in two scripts' lookups is applied twice
- where: packages/font/src/outline/gposKerning.ts:38–86
- scenario: a font's `kern` features for `DFLT` and for `latn` point at different lookups that both cover the same pair.
  - The code applies the union of all lookups and adds each hit (`total += value`), so "AV" gets twice its kerning. A shaper applies only the lookups of one script's LangSys.
  - Lookups shared between scripts are deduplicated by the `Set`, so only separate lookups that overlap trigger this.
  - Should: take the lookups of one LangSys only (`latn`, else `DFLT`).
- evidence: read; that shipping fonts duplicate pairs across per-script lookups is inferred
- severity: low

## fontEmbedding answers null when the face is re-registered while it loads
- where: packages/font/src/outline/fontEmbedding.ts:13–14
- scenario: `fontEmbedding` waits on the load of the registration that existed when it was called. If `registerFontOutlines` replaces that registration in the meantime:
  - The old load resolves `'ready'`, but `outlineFace` then looks up the new registration, which hasn't loaded yet, and returns `null`.
  - A PDF export then draws the face as outlines instead of embedding the font.
  - Should: retry, or have the load return the face it loaded.
- evidence: read
- severity: low

## Files read
packages/font/src/outline/OutlineFace.ts
packages/font/src/outline/cffCheck.ts
packages/font/src/outline/cmapCheck.ts
packages/font/src/outline/dataFork.ts
packages/font/src/outline/fontEmbedding.ts
packages/font/src/outline/fontFiles.fixture.ts
packages/font/src/outline/gposKerning.ts
packages/font/src/outline/localFonts.ts
packages/font/src/outline/opentypeParser.ts
packages/font/src/outline/outlineRegistry.ts
packages/font/src/outline/sfnt.ts
packages/font/src/outline/tag.ts
packages/font/src/outline/writtenFont.fixture.ts

<!-- done: 6 findings, files read: 13 -->