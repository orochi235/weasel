# font.outline findings

## GPOS lookup subtable counts are never charged to the work budget, so a small font can expand billions of subtables
- where: packages/font/src/outline/gposKerning.ts:207 (pairSubtables)
- scenario: a GPOS with one `kern` feature listing 65535 lookup indexes (charged 65535 steps, well inside `4 * bytes + 0x10000` for a ~400 KB font), whose LookupList entries all point at one lookup of type 9 (or 2) with `subTableCount` 65535, every subtable offset pointing at one PairPos (type 9: one extension header). `pairSubtables` runs once per distinct index and loops `count` subtables each, with no `spend`: ~4.3e9 iterations and arrays of 4.3e9 numbers, so `gposPairKerning` hangs or runs out of memory during the parse. Then every uncached `kernOf` call walks all of them again in `pairKerning`. `workBudget` exists to stop exactly this: "a small GPOS whose tables share one long list cannot hold the parser expanding it". The subtable loop should `spend(count)`.
- evidence: read
- severity: medium
- size: line
- cause: subtable loop not budgeted
- confidence: likely

## A CFF2 face's embedding probably reports `outlines: 'truetype'`
- where: packages/font/src/outline/opentypeParser.ts:185 (embeddingOf)
- scenario: a variable OpenType font with a `CFF2` table and no `glyf`. The parser accepts it (`checkCff` handles CFF2, and opentype.js reads it), but `outlines` is `'cff'` only when `t.cff` is set. If opentype.js stores a CFF2 Top DICT anywhere other than `tables.cff`, the embedding says `'truetype'`, so a PDF writer embeds it as a TrueType program with no `glyf` table and the glyphs come out blank. The check should be on the sfnt's own tables (`tableOf(sfnt, 'CFF ') ?? tableOf(sfnt, 'CFF2')`, as the parser already does). The `FaceEmbedding.outlines` doc ("a `CFF ` table and no `glyf`") is silent on CFF2. Not verified: opentype.js is not installed in this tree.
- evidence: read
- severity: low
- fix: packages/font/src/outline/opentypeParser.ts, packages/font/src/outline/OutlineFace.ts
- size: line
- cause: outline kind read from parser state rather than tables
- confidence: likely

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

<!-- done: 2 findings, files read: 15 -->
