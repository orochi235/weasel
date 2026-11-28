## GPOS pair-lookup subtable lists are never charged to the work budget, so a small font can expand to billions of subtable offsets
- where: packages/font/src/outline/gposKerning.ts:216 (pairSubtables)
- scenario: a GPOS whose `kern` feature lists 4096 distinct lookup indices (8 KB), whose LookupList points all 4096 entries at one shared lookup (8 KB) with `subTableCount` 65535 and a 131 KB offset array. `spend` is charged only for the feature's 4096 indices, well inside the budget for a ~150 KB file. `pairSubtables` then runs once per distinct index, and each run pushes 65535 offsets: about 268M numbers (~2 GB). After that, every `kernOf` call walks all of them in `pairKerning`. The parse hangs or runs out of memory, the exact case `workBudget` exists to stop. It should be charged and give up (return null), like the feature, ScriptList and LangSys reads.
- evidence: read
- severity: high
- fix: packages/font/src/outline/gposKerning.ts (pass `spend` into `pairSubtables` and `spend(count)`, or memoize by lookup offset rather than index)
- size: line
- cause: unbudgeted subtable count
- confidence: likely

## The cmap and CFF checks read a different table than opentype.js parses when a tag is listed twice or a table's length runs past the file
- where: packages/font/src/outline/opentypeParser.ts:236 (createOpenTypeParser), packages/font/src/outline/sfnt.ts:63 (tableOf)
- scenario: `tableOf` takes the first record with a tag, and returns null when `offset + length` runs past the file. opentype.js reads tables at their offset, ignores the length, and keeps the last record for `CFF `/`CFF2` and parses every `cmap` record. So (a) a truncated or damaged file whose `CFF ` or `cmap` record states an overlong length skips `checkCff`/`checkCmap` entirely, and opentype.js then parses the table from its offset; (b) a font listing `cmap` or `CFF ` twice has only the first copy checked. Either way the hang and heap blow-up the checks were written to refuse reach opentype.js. The same mismatch decides `glyf`/`loca` presence: an overlong `glyf` record makes the code treat a TrueType font as CFF. These should refuse a duplicate tag or out-of-file table, or check exactly what opentype.js will read.
- evidence: read (opentype.js table-entry behavior from memory of its source)
- severity: medium
- fix: packages/font/src/outline/sfnt.ts, packages/font/src/outline/opentypeParser.ts
- size: function
- cause: table lookup disagrees with parser's
- confidence: likely

## Pairs kerned only under a language-specific LangSys get kerned in default text
- where: packages/font/src/outline/gposKerning.ts:286 (pairKerning), packages/font/src/outline/gposKerning.ts:116 (lookupIndexSets)
- scenario: `lookupIndexSets` emits one set per LangSys: `latn` default, then each `latn` language system (e.g. `NLD `, `TRK `), then `DFLT`. `pairKerning` returns the first set that kerns the pair. A pair that `latn` default leaves unkerned but a language-specific LangSys kerns gets that language's adjustment in ordinary Latin text, which no shaper does. The doc comment calls the sets alternatives, but they are applied as a fallback chain. Language systems should come after every script's default LangSys, or be left out.
- evidence: read
- severity: low
- size: function
- cause: language systems used as fallback
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

<!-- done: 3 findings, files read: 15 -->
