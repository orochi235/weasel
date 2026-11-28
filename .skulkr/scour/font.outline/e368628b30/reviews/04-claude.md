# font.outline findings

## The CFF and cmap pre-checks are skipped for a table whose recorded length runs past the file, while opentype.js still reads it
- where: packages/font/src/outline/opentypeParser.ts:241 (createOpenTypeParser), packages/font/src/outline/sfnt.ts:62 (tableOf)
- scenario: take the 2.6 KB face the CFF check exists for (a Top DICT offset operator with two operands) and set its `CFF ` table record's length to 0xffffffff. `tableOf(single, 'CFF ')` answers `null` because `offset + length > byteLength`, so `checkCff` never runs (or, when the font also has a `CFF2` table, the `??` checks `CFF2` instead of the table opentype.js reads). opentype.js parses the CFF from the record's offset into the whole font and never consults the length, so the parser is held for a minute again. The same edit to the `cmap` record skips `checkCmap`, and a format 12 group ending at 0xffffffff then writes until the heap runs out. A table that runs past the file should be refused, or checked from its offset to the end of the file, not skipped.
- evidence: read (opentype.js reading by offset alone is from memory of its `parse`, not read here)
- severity: high
- fix: packages/font/src/outline/sfnt.ts, packages/font/src/outline/opentypeParser.ts
- size: function
- cause: "missing table" and "table runs past the file" share one `null`
- confidence: likely

## GPOS ScriptList records that share one Script table multiply LangSys iteration past the work budget
- where: packages/font/src/outline/gposKerning.ts:124 (lookupIndexSets)
- scenario: a GPOS whose ScriptList holds 65,535 records all pointing at one Script table with 65,535 LangSys records (~800 KB of tables). `langSysesOf` memoizes the Script table, so `spend(langSysCount)` is charged once, but `scripts` gets one entry per record sharing the same `langSysAt`, and the loop at line 149 walks all 65,535 × 65,535 ≈ 4.3e9 entries doing a `langSysSeen.has` each. The budget (4 per byte, ~3.2M here) never trips, and the face's load hangs for minutes. Dedupe `scripts` by Script table offset, or spend per record walked.
- evidence: read
- severity: medium
- size: line
- cause: memoized table shared by records, iteration not budgeted
- confidence: likely

## pairSubtables is outside the work budget, so lookups sharing one subtable list expand to billions of entries
- where: packages/font/src/outline/gposKerning.ts:213 (pairSubtables), called from readPairKerning:76
- scenario: a `kern` feature naming 65,535 distinct lookup indexes (spent: 65,535 steps, within budget for a 200 KB font) whose LookupList entries all point at one PairPos lookup with 65,535 subtable offsets. `subtablesOf` memoizes by lookup *index*, not lookup offset, and `pairSubtables` spends nothing, so it reads 65,535 × 65,535 offsets and builds `lookupSets` holding ~4.3e9 numbers: the load hangs or runs out of memory, where the budget's stated intent is to answer `null`. Every later `kernOf` would also walk that set per pair. Spend each subtable read (or memoize by lookup offset).
- evidence: read
- severity: medium
- size: function
- cause: unbudgeted read, memo keyed by index not offset
- confidence: likely

## A WOFF's output buffer is sized from recorded lengths up to 1032× the file before any table inflates
- where: packages/font/src/outline/woff.ts:43 (sfntFromWoff)
- scenario: a 2 MB WOFF whose compressed tables each record `origLength = 1032 × compLength`. The ratio check passes, and `new ArrayBuffer(size)` asks for ~2 GB before `inflateInto` can find that the streams decompress to far less. The allocation either fails (the face fails to load, which is fine) or succeeds and holds 2 GB through every `await` of the inflate loop in a tab. The header's `totalSfntSize` (offset 16) states the real size and is never compared, nor is the buffer grown as tables actually inflate.
- evidence: read
- severity: low
- size: function
- cause: allocation trusts recorded lengths
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

<!-- done: 4 findings, files read: 15 -->
