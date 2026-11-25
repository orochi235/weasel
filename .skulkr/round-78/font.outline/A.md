# Audit round 78 — font.outline

## The CFF check skips every `CFF ` table whose major version byte is not 1, not only CFF2
- where: packages/font/src/outline/cffCheck.ts:29 (checkCff)
- scenario: a damaged `CFF ` table whose first byte reads 0, 3 or 255 instead of 1. `checkCff` returns at once, so none of its INDEX or DICT checks run. As far as I can tell, opentype.js branches only on `formatMajor === 2`, so it would read the table as CFF 1 anyway, and that is the trusting read the module exists to guard (the 2.6 KB face that held the parser for a minute). One flipped header byte would bring the hang back. The gate should skip only major 2, which is what the doc comment's "CFF2 passes unread" says, or it should refuse an unknown version. Separately, `opentypeParser.ts:227` checks only `CFF `, so a font's `CFF2` table is never checked either.
- evidence: read (cffCheck, opentypeParser). That opentype.js reads a version-0/3 table as CFF 1 is my inference; there is no node_modules in this tree to confirm it.
- severity: medium

## `enableLocalFontOutlines` replaces outline registrations the app already made for the same variant
- where: packages/font/src/outline/localFonts.ts:166 (enableLocalFontOutlines)
- scenario: an app registers its own `Inter` 400/normal from a URL, then calls `enableLocalFontOutlines()` with no `families` filter on a machine that also has Inter installed. Every installed face is passed to `registerFontOutlines`, which calls `slots.set`, so the app's registration is overwritten with no warning. The canvas then draws the local copy, which can be a different version, through a different parser. DOM text switches to `local(...)` too. Nothing in the function's doc or its result says an existing registration was displaced. Expected: skip variants already registered, or report the ones it replaced.
- evidence: read
- severity: low

## The PostScript name is answered in two places, and the two can disagree
- where: packages/font/src/outline/sfnt.ts:95 (postScriptNameAt) vs packages/font/src/outline/opentypeParser.ts:166 (englishNameOf, used by embeddingOf)
- scenario: picking a collection member and the variable-font default-instance check both take the first nameID 6 record on any platform, with zero bytes stripped. The embedding's `postScriptName` comes from opentype.js's English-name lookup instead. Take a font whose Macintosh and Windows nameID 6 records differ, or whose Windows record is not ASCII. The member is matched as "A", but the PDF embedding names it "B". A variable font can also pass or fail the default-instance check on a name the embedding never reports. Neither reader bounds its reads to the `name` table's length, so a bad string offset reads bytes from a neighboring table as the name.
- evidence: read
- severity: low

## An empty PostScript name selects the collection's first member and reports a match
- where: packages/font/src/outline/sfnt.ts:179 (sfntFromCollection)
- scenario: `createOpenTypeParser('')` on a `.ttc`. This happens when `queryLocalFonts` returns a face whose `postscriptName` is empty: `localFonts.ts:168` passes it straight through. `postScriptName ? … : 0` treats `''` as absent, so the first member (usually Regular) comes back with `matched: true`. The Bold slot then draws Regular outlines, which is exactly the case the parser's doc says it rejects. Expected: test with `!== undefined`, so an empty name matches nothing and rejects.
- evidence: read
- severity: low

## Files read
packages/font/src/outline/OutlineFace.ts
packages/font/src/outline/cffCheck.ts
packages/font/src/outline/closeContours.ts
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
packages/font/src/outline/woff.ts
packages/font/src/outline/writtenFont.fixture.ts

<!-- done: 4 findings, files read: 15 -->
