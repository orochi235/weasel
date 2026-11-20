I read all 13 files, but I couldn't save the findings: writing `.skulk/out/findings.md` needed a permission that wasn't granted. The full document is below instead.

One discrepancy: commit `44e73a944bea29d4d56fc7883fa302daec48ecf1` doesn't exist in this clone. I read the working tree at HEAD `782733b19c`, and `git status` shows no local changes under `packages/font/src/outline/`.

```markdown
# font.outline findings

## checkCff never reads the FDArray's Font DICTs, so a CID-keyed CFF with a damaged FD `Private` reaches opentype.js unchecked
- where: packages/font/src/outline/cffCheck.ts:37-46 (checkCff)
- scenario: Take an OTTO font whose Top DICT has an FDArray (a CID-keyed CFF, the usual shape for CJK faces). checkCff only runs `readIndex` over the FDArray INDEX (line 44). It never runs `readDict` on each item, or `checkPrivate` on each item's `Private`/`Subrs`. opentype.js 2.0.0 runs every FDArray item through `gatherCFFTopDicts` (dist/opentype.mjs:7264 → 6557-6566), which reads `private[0]`, `private[1]` and `privateOffset + privateDict.subrs` exactly as it does for the Top DICT. So a Font DICT whose `Private` (18) has the wrong number of operands hands opentype.js an array where it adds an offset. That is the "number plus array as a string" hang this module exists to stop, and the check passes the font.
- evidence: read (cffCheck.ts, and opentype.js 2.0.0's gatherCFFTopDicts / parseCFFTable)
- severity: medium

## The CFF and cmap checks are skipped for WOFF input, and the CFF check runs only for an `OTTO` signature
- where: packages/font/src/outline/opentypeParser.ts:206-209 (createOpenTypeParser)
- scenario: (a) A WOFF 1 file, which the parser accepts and its own WOFF2 error recommends: `tableOf` reads the WOFF header as an sfnt directory and finds no `CFF `/`cmap` record, so it returns null and neither `checkCff` nor `checkCmap` runs. opentype.js still decompresses and parses those tables with the same trust. A damaged WOFF whose format 12 group ends at 0xffffffff exhausts the heap, which is exactly the case `checkCmap` guards for a raw sfnt. (b) A font with sfntVersion 0x00010000 or `true`, a `CFF ` table and no `glyf`/`loca`: opentype.js parses the CFF whenever there is no glyf+loca pair, whatever the signature (dist/opentype.mjs:16200-16207). But `isCff(single)` is false, so `checkCff` is skipped. The checks should run on the tables opentype.js will actually parse.
- evidence: read
- severity: medium

## A WOFF face loses every kerning pair behind a GPOS Extension lookup, while the same font as TTF/OTF keeps them
- where: packages/font/src/outline/opentypeParser.ts:95-101 (createOutlineFace kernOf), packages/font/src/outline/gposKerning.ts:28-30
- scenario: `gposPairKerning` returns null for a WOFF ("A WOFF's tables are compressed"), so `kernOf` falls back to `font.getKerningValue`. In opentype.js 2.0.0, `getKerningTables` reads only lookupType 2, and `subtableParsers2[9]` returns `{ error: "GPOS Lookup 9 not supported" }` (dist/opentype.mjs:9875-9878, 15854). That missing support is the reason gposKerning.ts exists. So Inter registered as `.woff` kerns none of its class pairs, while Inter `.ttf` kerns them all: two answers to one question, and for a family with no atlas this changes layout advances.
- evidence: read
- severity: medium

## gposPairKerning's memo grows with no bound
- where: packages/font/src/outline/gposKerning.ts:73-87
- scenario: The returned closure memoizes every (left, right) glyph pair it is asked about in a `Map` that is never pruned, and it lives as long as the face, which is as long as the registration. Long-running editing of varied text, or a CJK face with tens of thousands of glyphs, adds one entry per distinct adjacent pair, up to glyphCount² keys. A bounded cache (or none, since the lookup is a couple of binary searches) would stop the growth.
- evidence: read
- severity: low

## loadFontOutlines / fontEmbedding report the status of a registration that was replaced while it loaded
- where: packages/font/src/outline/outlineRegistry.ts:278-286 (loadFontOutlines), packages/font/src/outline/fontEmbedding.ts:13-14
- scenario: `loadFontOutlines` captures the slot, awaits `beginLoad(slot)`, then returns `slot.status` from that captured slot. If the face is registered again during the await (a second `enableLocalFontOutlines`, or a consumer swapping the source), it resolves 'ready' for the dropped slot. `fontEmbedding` then calls `outlineFace`, which finds the new idle slot, starts its load and returns null. So the export gets no embedding although a loadable face is registered, and `loadFontOutlines` reports 'ready' for a face that `outlineStatus` says is 'loading'. It should re-read the current slot after the await (and wait on it).
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

<!-- done: 5 findings, files read: 13 -->
```

<!-- done: 5 findings, files read: 13 -->